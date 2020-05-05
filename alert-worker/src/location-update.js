const mysql = require('mysql2/promise')
const EventEmitter = require('events')
const _ = require('lodash')
const Promise = require('bluebird')
const { DateTime } = require('luxon')

// load local files
const logger = require('./utils/logger')('location-update')
const db = require('./utils/db')
const arrayToUnion = db.arrayToUnion
const DATETIME_FORMAT = require('./utils/date-time').DEFAULT_SQL_DATETIME_FORMAT
const formatDateTime = require('./utils/date-time').formatDateTime
const WORKER_ID = process.env.WORKER_ID || 'worker'

/**
 * Steps:
 * 1. Get latest data from DB, order by most recent. process everything not in the `face_logs_processed` table. Get from the beginning of time, chunk N number of data at a time.
 * 2. generate person's location(s) as per the timeline.
 *  a. collect to "person_id": Array<{ "zone_id", "from", "to" }>
 * 3. Update person's location.
 * 4. Done
 */

// function assumes that data has been sorted in ascending order, based on the timestamp of the camera log.
function collectPeopleData (data) {
  const peopleCurrentZone = new Map()
  const peopleLocationData = new Map()

  data.forEach(row => {
    const isKnown = Number.parseInt(row.is_known) === 1
    const personId = isKnown ? `${row.person_id}` : `U-${row.person_id}`
    if (!peopleCurrentZone.has(personId)) {
      peopleCurrentZone.set(personId, {
        zone_id: row.zone_id,
        is_known: isKnown,
        from: row.creation_time
      })
    } else {
      const currentLocationData = peopleCurrentZone.get(personId)
      if (currentLocationData.zone_id !== row.zone_id) {
        if (!peopleLocationData.has(personId)) {
          peopleLocationData.set(personId, [])
        }

        peopleLocationData.get(personId).push({
          person_id: row.person_id,
          is_known: currentLocationData.is_known,
          zone_id: currentLocationData.zone_id,
          from: currentLocationData.from,
          to: row.creation_time
        })
        peopleCurrentZone.set(personId, {
          zone_id: row.zone_id,
          is_known: isKnown,
          from: row.creation_time
        })
      }
    }
  })

  // push current zone data
  peopleCurrentZone.forEach((currentLocationData, personId) => {
    const isKnown = !personId.includes('U-')
    const id = isKnown ? personId : personId.substring(2)

    if (!peopleLocationData.has(personId)) {
      peopleLocationData.set(personId, [{
        person_id: id,
        is_known: isKnown,
        zone_id: currentLocationData.zone_id,
        from: currentLocationData.from,
        to: null
      }])
    } else {
      peopleLocationData.get(personId).push({
        person_id: id,
        is_known: isKnown,
        zone_id: currentLocationData.zone_id,
        from: currentLocationData.from,
        to: null
      })
    }
  })

  return peopleLocationData
}

function generateUpdateLocationQueries (existingLocationResults, peopleLocation, isKnown) {
  // update their initial locations
  const sqlUpdateInitialLocation = `
  UPDATE zone_persons
  SET \`to\` = ?, worker_updated_at = ?
  WHERE person_id = ?
    AND is_known = ${isKnown ? 'TRUE' : 'FALSE'}
    AND \`to\` IS NULL;
  `
  const sqlInsertInitialLocation = `
    INSERT INTO zone_persons (\`person_id\`, \`zone_id\`, \`is_known\`, \`from\`, \`to\`, \`worker_created_at\`)
    VALUES (?, ?, ${isKnown ? 'TRUE' : 'FALSE'}, ?, ?, ?)
    ON DUPLICATE KEY UPDATE person_id=person_id, is_known=is_known, zone_id=zone_id, \`from\`=\`from\`;
  `

  let queries = ''
  existingLocationResults.forEach(row => {
    const personKey = isKnown ? `${row.id}` : `U-${row.id}`
    let firstLocationData = peopleLocation.get(personKey)[0]
    if (row.from === null) { // no existing location. zone_id is also NULL.
      queries += mysql.format(sqlInsertInitialLocation, [
        firstLocationData.person_id,
        firstLocationData.zone_id,
        formatDateTime(firstLocationData.from),
        formatDateTime(firstLocationData.to),
        WORKER_ID
      ])
    } else {
      // check if the FIRST row in the generated new location data indicates that the person has moved from initial location.
      // check this based on the `from` field.
      // data from existing `zone_`
      const fromExisting = row.from
      let fromFaceLog = firstLocationData.from
      let toFaceLog = _.isEmpty(firstLocationData.to) ? null : firstLocationData.to

      if (toFaceLog === null) {
        if (fromFaceLog >= fromExisting && row.zone_id !== firstLocationData.zone_id) {
          // person moved from initial location.
          queries += mysql.format(sqlUpdateInitialLocation, [
            DateTime.fromJSDate(firstLocationData.from).toFormat(DATETIME_FORMAT),
            WORKER_ID,
            row.id
          ])
          queries += mysql.format(sqlInsertInitialLocation, [
            firstLocationData.person_id,
            firstLocationData.zone_id,
            formatDateTime(firstLocationData.from),
            formatDateTime(firstLocationData.to),
            WORKER_ID
          ])
        }
      } else {
        if (toFaceLog <= fromExisting) {
          // try to peek next data that is not stale.
          let isStale = true
          const locations = peopleLocation.get(personKey)
          do {
            locations.shift()
            if (locations.length >= 1) {
              firstLocationData = locations[0]
              fromFaceLog = firstLocationData.from
              toFaceLog = firstLocationData.to || null
              isStale = toFaceLog !== null ? toFaceLog > fromExisting : fromFaceLog > fromExisting
            }
          } while (isStale && locations.length > 0)

          if (toFaceLog <= fromExisting) {
            return // all data from the person is stale.
          }
        }

        // same zone
        if (row.zone_id === firstLocationData.zone_id) {
          queries += mysql.format(sqlUpdateInitialLocation, [
            formatDateTime(firstLocationData.to),
            WORKER_ID,
            firstLocationData.person_id
          ])
        } else { // different zone
          // person moved from initial location.
          if (fromFaceLog >= fromExisting) {
            queries += mysql.format(sqlUpdateInitialLocation, [
              formatDateTime(firstLocationData.from),
              WORKER_ID,
              firstLocationData.person_id
            ])
          } else {
            queries += mysql.format(sqlUpdateInitialLocation, [
              formatDateTime(row.from),
              WORKER_ID,
              firstLocationData.person_id
            ])
          }
          queries += mysql.format(sqlInsertInitialLocation, [
            firstLocationData.person_id,
            firstLocationData.zone_id,
            formatDateTime(firstLocationData.from),
            formatDateTime(firstLocationData.to),
            WORKER_ID
          ])
        }
      }
    }
  })
  return queries
}

function cancelFirstTransaction (faceLogIds) {
  logger.warn('Rolling back first transaction')
  // execute rollback
  const sqlRollbackFirstTransaction = `
    DELETE FROM face_logs_processed
    WHERE face_log_id IN (?);
  `

  return db.withTransaction(tx => tx.query(sqlRollbackFirstTransaction, [faceLogIds]))
}

const JOB_STATE_PROCESSING = 'P'
const JOB_STATE_DONE = 'D'
function main () {
  const faceLogIds = []
  let firstTransactionCompleted = false

  logger.info('Starting LocationUpdater...')
  return db.withTransaction(conn => {
    // first transaction: get face logs to process.
    logger.debug('Getting face logs data')
    const sql = `
    SELECT
      fl.id AS face_log_id,
      z.id AS zone_id,
      TIMESTAMP(fl.creation_time) AS creation_time,
      (fl.unknown_person_id IS NULL) AS is_known,
      (CASE WHEN fl.unknown_person_id IS NOT NULL THEN fl.unknown_person_id
      ELSE fl.person
      END) AS person_id
    FROM face_logs fl
    LEFT JOIN face_logs_processed flp ON fl.id = flp.face_log_id
    JOIN cameras c ON fl.camera_name = c.name
    JOIN zones z ON z.name = c.zone_name
    WHERE flp.state IS NULL OR (flp.worker_id = ? AND flp.state = ?)
    ORDER BY creation_time
    LIMIT ?
    FOR UPDATE;
    `
    return conn.query(sql, [WORKER_ID, JOB_STATE_PROCESSING, Number.parseInt(process.env.CHUNK_SIZE || 5000)])
      .then(([results]) => {
        // collect data, mark face_logs_id as processing
        faceLogIds.push(...results.map(r => r.face_log_id))
        const now = formatDateTime(new Date())
        const sql2 = `INSERT INTO face_logs_processed (face_log_id, state, worker_id, created_at) VALUES ? ON DUPLICATE KEY UPDATE face_log_id=face_log_id;`
        const params = [results.map(r => [r.face_log_id, JOB_STATE_PROCESSING, WORKER_ID, now])]
        if (faceLogIds.length === 0) {
          logger.warn('No log to process.')
          return []
        }

        return conn.query(sql2, params).then(() => results)
      })
  })
    .then(results => {
      logger.debug('first transaction done.')
      firstTransactionCompleted = true
      return results
    })
    .then(rows => {
      logger.debug('collecting people data')
      peopleLocation = collectPeopleData(rows)
      const knownPeopleIds = []
      const unknownPeopleIds = []
      Array.from(peopleLocation.keys()).forEach(personId => {
        if (!personId.includes('U-')) {
          knownPeopleIds.push(personId)
        } else {
          unknownPeopleIds.push(personId.substring(2))
        }
      })
      return {
        peopleLocation,
        knownPeopleIds,
        unknownPeopleIds
      }
    })
    .then(({ peopleLocation, knownPeopleIds, unknownPeopleIds }) => {
      // second transaction: get location of each person and update, mark job as done.
      if (peopleLocation.size === 0) {
        const meta = { logsProcessed: faceLogIds.length, peopleProcessed: peopleLocation.size }
        logger.info(`No location to update.`, meta)
        return
      }
      logger.debug('Starting second transaction')
      return db.withTransaction(conn => {
        const sqlLockPeople = `
SELECT persons.id, zp.from, zp.zone_id
FROM persons
LEFT JOIN zone_persons zp ON
  zp.person_id = persons.id AND
  zp.is_known = true AND
  zp.to IS NULL
WHERE persons.id IN (?)
FOR UPDATE`
        logger.debug('Locking known people locations')
        // set current locations of known people, using data on first row.
        return conn.query(sqlLockPeople, [knownPeopleIds])
          .then(results => {
            let queries = generateUpdateLocationQueries(results[0], peopleLocation, true)
            if (queries === '') {
              return { peopleLocation, unknownPeopleIds }
            }

            return conn.query(queries).then(() => ({ peopleLocation, unknownPeopleIds }))
          })
          .then(({ peopleLocation, unknownPeopleIds }) => {
            // if no unknown person, skip this step.
            if (unknownPeopleIds.length === 0) {
              logger.info('No unknown people detected.')
              return peopleLocation
            }
            const sqlLockUnknownPeopleLocation = `
              SELECT
                p.id,
                zp.zone_id,
                zp.person_id,
                zp.\`from\`
              FROM (
                ${arrayToUnion(unknownPeopleIds.map(id => Number.parseInt(id)), 'id')}
              ) p
              LEFT JOIN zone_persons zp
                ON zp.person_id = p.id
                AND is_known IS FALSE
                AND \`to\` IS NULL
              FOR UPDATE
            `
            logger.debug('Locking unknown people locations')
            return conn.query(sqlLockUnknownPeopleLocation)
              .then(results => {
                // update initial locations
                let queries = generateUpdateLocationQueries(results[0], peopleLocation, false)
                if (_.isEmpty(queries)) {
                  return
                }

                return conn.query(queries)
              })
              .then(() => peopleLocation)
          })
          .then(peopleLocation => {
            // process remaining data
            logger.debug('processing remaining location data')
            const sqlInsertLocationData = `
              INSERT INTO zone_persons (\`person_id\`, \`zone_id\`, \`is_known\`, \`from\`, \`to\`, created_at, \`worker_created_at\`)
              VALUES ?
              ON DUPLICATE KEY UPDATE person_id=person_id, zone_id=zone_id, is_known=is_known, \`from\`=\`from\`;
            `
            const data = []
            const now = formatDateTime(new Date())
            peopleLocation.forEach(locations => {
              if (locations.length > 1) {
                for (let i = 1; i < locations.length; i++) {
                  // person_id, is_known, from, to, worker_id
                  data.push([
                    locations[i].person_id,
                    locations[i].zone_id,
                    locations[i].is_known,
                    formatDateTime(locations[i].from),
                    formatDateTime(locations[i].to),
                    now,
                    WORKER_ID
                  ])
                }
              }
            })

            if (data.length > 0) {
              return conn.query(sqlInsertLocationData, [data])
            }
          })
          .then(() => {
            logger.debug('Job finished. Marking as done...')
            // mark jobs as done.
            const sqlUpdateJobDone = `
              UPDATE face_logs_processed
              SET state = ?
              WHERE face_log_id IN (?)
                AND worker_id = ?;
            `
            return conn.query(sqlUpdateJobDone, [JOB_STATE_DONE, faceLogIds, WORKER_ID])
          })
          .then(() => {
            const meta = { logsProcessed: faceLogIds.length, peopleProcessed: peopleLocation.size }
            logger.info(`Updated location(s). Affected people: ${meta.peopleProcessed}. Logs processed: ${meta.logsProcessed}`, meta)
            LocationUpdater.events.emit('finish', meta)
          })
      })
    })
    .catch(err => {
      if (firstTransactionCompleted) {
        cancelFirstTransaction(faceLogIds)
          .catch(e => {
            err.stack += `
In addition. The following error is caught when trying to rollback first transaction:
${e.stack.split('\n').slice(0,2).join('\n')}
`
          })
          .finally(() => {
            throw err
          })
      } else {
        throw err
      }
    })
}

const LocationUpdater = {
  _instance: null,
  run: function () {
    if (this._instance !== null) {
      return this._instance
    }
    this._instance = main()
      .catch(err => {
        logger.error(err)
        LocationUpdater.events.emit('error', err)
      })
      .finally(function () {
        this._instance = null // cleanup running instance.
      }.bind(this))
    return this._instance
  },
  isRunning: function () {
    return this._instance !== null
  },
  events: new EventEmitter()
}
Object.freeze(LocationUpdater)
module.exports = LocationUpdater
