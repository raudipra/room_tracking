const mysql = require('mysql2/promise')
const _ = require('lodash')
const Promise = require('bluebird')

require('dotenv').config()

const db = require('./db')
const arrayToUnion = db.arrayToUnion

const { DateTime, Duration, Settings } = require('luxon')
Settings.defaultZoneName = process.env.TIMEZONE || 'Asia/Jakarta'
const WORKER_ID = process.env.WORKER_ID || 'worker'
const DATETIME_FORMAT = 'yyyy-LL-dd HH:mm:ss'

const ALERT_TYPES = {
  UNKNOWN: 'U',
  UNAUTHORIZED: 'A',
  OVERSTAY: 'O'
}

/**
 * Converts a JS {@link Date} to SQL DateTime string
 * @param {?Date} dateTime
 * @returns {?string} SQL-formatted DateTime
 */
function formatDateTime (dateTime) {
  if (_.isUndefined(dateTime) || _.isNull(dateTime)) return null

  return DateTime.fromJSDate(dateTime).toFormat(DATETIME_FORMAT)
}

/**
 * Steps:
 * 1. Get latest data from DB, order by most recent. process everything not in the `face_logs_processed` table. Get from the beginning of time, chunk N number of data at a time.
 * 2. generate person's location(s) as per the timeline.
 *  a. collect to "person_id": Array<{ "zone_id", "from", "to" }>
 * 3. Update person's location.
 * 4. Generate alert(s) based on the person's latest data
 * 5. Done
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

const sqlInsertAlert = `
  INSERT INTO zone_alerts (id, zone_id, type, details, person_id, is_known, worker_id)
  VALUES (uuid(), ?, ?, ?, ?, ?, ?);
`
function generateAlerts (results, conn) {
  const now = DateTime.local()
  // since some alert requires 'backoff',
  const alertQueryPromises = []
  results.forEach(row => {
    const zone = {
      id: row.zone_id,
      config: row.config
    }
    row.is_known = Number.parseInt(row.is_known) === 1

    // alert 1: person is unknown
    if (!row.is_known) {
      alertQueryPromises.push(generateAlert(now, row, ALERT_TYPES.UNKNOWN))
    }

    // alert 2: person is unauthorized
    if (_.has(zone, 'config.is_active')) {
      if (!zone.config.is_active) {
        alertQueryPromises.push(generateAlert(now, row, ALERT_TYPES.UNAUTHORIZED))
      }
    }

    // alert 3: overstay
    if (_.has(zone, 'config.overstay_limit')) {
      const overstayLimit = zone.config.overstay_limit
      const parts = overstayLimit.split(':') // HH:MM
      const overstayLimitDuration = Duration.fromObject({
        hours: parts[0],
        minutes: parts[1]
      })
      const atZoneFrom = DateTime.fromSQL(row.from)

      if (atZoneFrom.diff(now) > overstayLimitDuration) {
        alertQueryPromises.push(generateAlert(now, row, ALERT_TYPES.OVERSTAY))
      }
    }
  })

  return Promise.all(alertQueryPromises)
    .then(results => results.reduce((prev, next) => {
      let queries = prev.queries || ''
      let alertUnknownPersonCount = _.has(prev, 'alertCounts.unknownPerson') ? prev.alertCounts.unknownPerson : 0
      let alertUnauthorizedCount = _.has(prev, 'alertCounts.unauthorized') ? prev.alertCounts.unauthorized : 0
      let alertOverstayCount = _.has(prev, 'alertCounts.overstay') ? prev.alertCounts.overstay : 0

      if (next.query !== null) {
        queries += next.query
        switch (next.alertType) {
          case ALERT_TYPES.UNKNOWN:
            alertUnknownPersonCount++
            break
          case ALERT_TYPES.UNAUTHORIZED:
            alertUnauthorizedCount++
            break
          case ALERT_TYPES.OVERSTAY:
            alertOverstayCount++
            break
        }
      }

      return {
        queries,
        alertCounts: {
          unknownPerson: alertUnknownPersonCount,
          unauthorized: alertUnauthorizedCount,
          overstay: alertOverstayCount
        }
      }
    }, {}))
    .then(results => conn.query(results.queries).then(() => results.alertCounts))
}

// do a quick check if similar alert in the room has been triggered ALERT_UNKNOWN_ ago.
// if not, raise the alert again.
function generateAlert (timestamp, personDetails, alertType) {
  const DEFAULT_BACKOFF = 10
  let backoffParam
  switch (alertType) {
    case ALERT_TYPES.UNKNOWN:
      backoffParam = process.env.ALERT_UNKNOWN_BACKOFF || DEFAULT_BACKOFF
      break
    case ALERT_TYPES.UNAUTHORIZED:
      backoffParam = process.env.ALERT_UNAUTHORIZED || DEFAULT_BACKOFF
      break
    case ALERT_TYPES.OVERSTAY:
      backoffParam = process.env.ALERT_OVERSTAY || DEFAULT_BACKOFF
      break
  }

  let backoffSeconds = Number.parseInt(backoffParam)
  if (!_.isFinite(backoffSeconds)) {
    backoffSeconds = DEFAULT_BACKOFF
  }
  const minDuration = Duration.fromObject({
    seconds: backoffSeconds
  })
  const minTimestamp = timestamp.minus(minDuration).toFormat(DATETIME_FORMAT)
  const sqlCheckExistingAlert = `
    SELECT EXISTS (
      SELECT *
      FROM zone_alerts
      WHERE zone_id = ?
        AND person_id = ?
        AND is_known = ?
        AND type = ?
        AND created_at > ?
    )
  `

  return Promise.using(db.getConnection(), conn => conn.query(sqlCheckExistingAlert,
    [personDetails.zone_id, personDetails.person_id, personDetails.is_known, alertType, minTimestamp]
  ).then(result => {
    const hasExistingAlert = Number.parseInt(result) === 1
    const details = JSON.stringify({ // TODO define for each alert type.
      from: personDetails.from
    })
    return hasExistingAlert ? {
      alertType: null,
      query: ''
    } : {
      alertType,
      query: mysql.format(sqlInsertAlert, [
        personDetails.zone_id, alertType, details, personDetails.person_id, personDetails.is_known, WORKER_ID
      ])
    }
  }))
}

function cancelFirstTransaction (faceLogIds) {
  console.info('Rolling back first transaction')
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
  const startTime = new Date()
  const faceLogIds = []
  let firstTransactionCompleted = false

  return db.withTransaction(conn => {
    // first transaction: get face logs to process.
    console.debug('Getting face logs data')
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
          return Promise.reject('no data to process.')
        }

        return conn.query(sql2, params).then(() => results)
      })
  })
    .then(results => {
      console.debug('first transaction done.')
      firstTransactionCompleted = true
      return results
    })
    .then(rows => {
      console.debug('collecting people data')
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
      // second transaction: get location of each person and update, generate alert, mark job as done.
      return db.withTransaction(conn => {
        console.debug('Starting second transaction')
        const sqlLockPeople = `
SELECT persons.id, zp.from, zp.zone_id
FROM persons
LEFT JOIN zone_persons zp ON
  zp.person_id = persons.id AND
  zp.is_known = true AND
  zp.to IS NULL
WHERE persons.id IN (?)
FOR UPDATE`
        console.debug('Locking known people locations')
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
            console.info('Locking unknown people locations')
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
            // get latest locations of people based on the worker
            const sqlGetPeopleLocation = `
              SELECT
                zones.id AS zone_id,
                zp.person_id,
                is_known,
                \`from\`,
                \`to\`,
                zones.config AS config
              FROM zone_persons zp
              JOIN zones ON zp.zone_id = zones.id
              WHERE (worker_created_at = ? OR worker_created_at = ?)
                AND \`to\` IS NULL
            `
            return conn.query(sqlGetPeopleLocation, [WORKER_ID, WORKER_ID])
          })
          .then(([results]) => generateAlerts(results, conn))
          .then(alertDetails => {
            console.info('Job finished. Marking as done...')
            // mark jobs as done.
            const sqlUpdateJobDone = `
              UPDATE face_logs_processed
              SET state = ?
              WHERE face_log_id IN (?)
                AND worker_id = ?;
            `
            return conn.query(sqlUpdateJobDone, [JOB_STATE_DONE, faceLogIds, WORKER_ID])
              .then(() => alertDetails)
          })
      })
    })
    .then(alertDetails => {
      // finished. print report
      const now = new Date()
      const secondsElapsed = (now.getTime() - startTime.getTime()) / 1000
      const totalAlertCount = Object.values(alertDetails).reduce((prev, curr) => prev + curr, 0)
      console.info(`
Job finished at [${now.toISOString()}].
Time Elapsed: ${secondsElapsed} s.
Alerts generated: ${totalAlertCount}.
- Unknown: ${alertDetails.unknownPerson}
- Unauthorized: ${alertDetails.unauthorized}
- Overstay: ${alertDetails.overstay}`
      )
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
      }
      console.error(err)
    })
}

let isRunning = false
const RUN_AT_MOST_EVERY_MS = 10 * 1000 // run every 10 seconds
isRunning = true
main().finally(() => {
  isRunning = false
})

setInterval(() => {
  if (isRunning) return
  isRunning = true
  main().finally(() => {
    isRunning = false
  })
}, RUN_AT_MOST_EVERY_MS)
