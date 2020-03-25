const mysql = require('mysql2/promise')
const _ = require('lodash')
const Promise = require('bluebird')
require('dotenv').config()

const { DateTime, Duration, Settings } = require('luxon')
Settings.defaultZoneName = process.env.TIMEZONE || 'Asia/Jakarta'

const ALERT_TYPES = {
  UNKNOWN: 'U',
  UNAUTHORIZED: 'A',
  OVERSTAY: 'O'
}
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 2,
  Promise: Promise
})

/**
 * Steps:
 * 1. Get latest data from DB, order by most recent. process everything not in the `face_logs_processed` table. Get from the beginning of time, chunk N number of data at a time.
 * 2. generate person's location(s) as per the timeline.
 *  a. collect to "person_id": Array<{ "zone_id", "from", "to" }>
 * 3. Update person's location.
 * 4. Generate alert(s) based on the person's latest data
 * 5.
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
          peopleLocationData.put(personId, [])
        }

        peopleLocationData.get(personId).push({
          person_id: row.person_id,
          is_known: currentLocationData.is_known,
          zone_id: currentLocationData.zone_id,
          from: currentLocationData.from,
          to: row.from
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
    peopleLocationData.get(personId).push({
      person_id: isKnown ? personId : personId.substring(2),
      is_known: isKnown,
      zone_id: currentLocationData.zone_id,
      from: currentLocationData.from,
      to: null
    })
  })

  return peopleLocationData
}

function generateUpdateLocationQueries (existingLocationResults, peopleLocation, isKnown) {
  // update their initial locations
  const sqlUpdateInitialLocation = `
  UPDATE zone_persons
  SET \`to\` = ?, worker_id = ?
  WHERE person_id = ?
    AND is_known = ${isKnown ? 'TRUE' : 'FALSE'}
    AND \`to\` IS NULL;
  `
  const sqlInsertInitialLocation = `
    INSERT INTO zone_persons (person_id, is_known, from, \`to\`, worker_id)
    VALUES (?, ${isKnown ? 'TRUE' : 'FALSE'}, ?, ?, ?);
  `
  let queries = ''
  existingLocationResults.forEach(row => {
    const personKey = isKnown ? row.person_id : `U-${row.person_id}`
    let firstLocationData = peopleLocation.get(personKey)[0]
    if (row.from === null) { // no existing location. zone_id is also NULL.
      queries += mysql.format(sqlInsertInitialLocation, [
        row.person_id, firstLocationData.from,
        firstLocationData.to, WORKER_ID
      ])
    } else {
      // check if the FIRST row in the generated new location data indicates that the person has moved from initial location.
      // check this based on the `from` field.
      // data from existing `zone_`
      const fromExisting = new Date(row.from)
      let fromFaceLog = new Date(firstLocationData.from)
      let toFaceLog = _.isNull(firstLocationData.to) ? null : new Date(firstLocationData.to)

      if (toFaceLog === null) {
        if (fromFaceLog >= fromExisting && row.zone_id !== firstLocationData.zone_id) {
          // person moved from initial location.
          queries += mysql.format(sqlUpdateInitialLocation, [
            firstLocationData.from, WORKER_ID, row.person_id
          ])
          queries += mysql.format(sqlInsertInitialLocation, [
            row.person_id, firstLocationData.from,
            firstLocationData.to, WORKER_ID
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
              fromFaceLog = new Date(firstLocationData.from)
              toFaceLog = _.isNull(firstLocationData.to) ? null : new Date(firstLocationData.to)
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
            firstLocationData.to, WORKER_ID, row.person_id
          ])
        } else { // different zone
          // person moved from initial location.
          if (fromFaceLog >= fromExisting) {
            queries += mysql.format(sqlUpdateInitialLocation, [
              firstLocationData.from, WORKER_ID, row.person_id
            ])
          } else {
            queries += mysql.format(sqlUpdateInitialLocation, [
              row.from, WORKER_ID, row.person_id
            ])
          }
          queries += mysql.format(sqlInsertInitialLocation, [
            row.person_id, firstLocationData.from,
            firstLocationData.to, WORKER_ID
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
function generateAlerts (results) {
  const now = DateTime.local()
  // since some alert requires 'backoff',
  const alertQueryPromises = []
  results.forEach(row => {
    const zone = {
      id: row.zone_id,
      config: JSON.parse(row.zone_config)
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
      const queries = prev.queries || {}
      const alertUnknownPersonCount = _.has(prev, 'alertCounts.unknownPerson') ? prev.alertCounts.unknown : 0
      const alertUnauthorizedCount = _.has(prev, 'alertCounts.unauthorized') ? prev.alertCounts.unauthorized : 0
      const alertOverstayCount = _.has(prev, 'alertCounts.overstay') ? prev.alertCounts.overstay : 0

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
    .then(results => conn.query(results)
      .then(() => results.alertCounts)
      .catch(err => {
        throw err
      })
    )
    .catch(err => {
      throw err
    })
}

// do a quick check if similar alert in the room has been triggered ALERT_UNKNOWN_ ago.
// if not, raise the alert again.
function generateAlert(timestamp, personDetails, alertType) {
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
  const minTimestamp = timestamp.minus(minDuration).toSQL({ includeOffset: false, includeZone: false })
  const sqlCheckExistingAlert = `
    SELECT EXISTS (
      SELECT *
      FROM zone_alerts
      WHERE zone_id = ?
        AND person_id = ?
        AND is_known = ?
        AND alert_type = ?
        AND created_at > ?
    )
  `

  return pool.query(sqlCheckExistingAlert, [personDetails.zone_id, personDetails.person_id, personDetails.is_known, alertType, minTimestamp])
    .then(result => {
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
          zoneId, alertType, details, personDetails.person_id, personDetails.is_known, WORKER_ID
        ])
      }
    })
}

const JOB_STATE_PROCESSING = 'P'
const JOB_STATE_DONE = 'D'
function main () {
  const WORKER_ID = process.env.WORKER_ID
  const startTime = new Date()
  const faceLogIds = []
  pool.getConnection()
    .then(conn => {
    // first transaction: get job, mark as PROCESSING
    let firstTransactionCompleted = false
    const firstTransaction = conn.beginTransaction()
      .then(() => {
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
        WHERE flp.state IS NULL
        ORDER BY creation_time
        LIMIT ${process.env.CHUNK_SIZE || 5000}
        FOR UPDATE;
        `
        return conn.query(sql)
      })
      .then(([results]) => {
        // collect data, mark face_logs_id as processing
        faceLogIds.push(...results.map(r => r.face_log_id))
        const sql2 = `INSERT INTO face_logs_processed (face_log_id, state, worker_id) VALUES ?`

        conn.query(sql2, [results.map(r => [r.face_log_id, JOB_STATE_PROCESSING, WORKER_ID])])
          .then(() => conn.commit())
          .then(() => {
            console.debug('first transaction done.')
            firstTransactionCompleted = true
          })
          .catch(err => {
            throw err
          })

        return results
      })
      .catch(err => {
        console.error(err)
        if (firstTransactionCompleted) {
          console.info('Rolling back first transaction')
          // execute rollback
          const sqlRollbackFirstTransaction = `
            DELETE FROM face_logs_processed
            WHERE face_log_id IN ?
          `
          conn.query(sqlRollbackFirstTransaction, [faceLogIds])
            .catch(err => {
              throw err
            })
        }
        throw err
      })

    // second transaction: get location of each person and update, generate alert, mark job as done.
    let peopleLocation
    const secondTransaction = firstTransaction
      .then(rows => {
        console.debug('collecting people data')
        peopleLocation = collectPeopleData(rows)
        const knownPeopleIds = []
        const unknownPeopleIds = []
        peopleLocation.keys().forEach(personId => {
          if (!personId.includes('U-')) {
            knownPeopleIds.push(personId)
          } else {
            unknownPeopleIds.push(personId.substring(2))
          }
        })
        console.debug('Starting second transaction')
        return conn.beginTransaction()
          .then(() => ({
            peopleLocation,
            knownPeopleIds,
            unknownPeopleIds
          }))
      })
      .then(({ peopleLocation, knownPeopleIds, unknownPeopleIds }) => {
        // get latest location of known people
        // this assumes that all NULL values indicates that the person is still within that region.

        const sqlLockPeople = `
          SELECT persons.id, zp.from, zp.zone_id
          FROM persons
          LEFT JOIN zone_persons zp ON
            zp.person_id = persons.id AND
            zp.is_known = true AND
            zp.\`to\` IS NULL
          WHERE persons.id IN ?
          FOR UPDATE
        `
        console.debug('Locking known people locations')

        // set current locations of known people, using data on first row.
        return conn.query(sqlLockPeople, [knownPeopleIds])
          .then(results => {
            let queries = generateUpdateLocationQueries(results[0], peopleLocation, true)
            console.debug(queries)
            return conn.query(queries)
              .then(() => ({ peopleLocation, unknownPeopleIds }))
          })
          .catch(err => {
            throw err
          })
      })
      .then(({ peopleLocation, unknownPeopleIds }) => {
        const sqlLockUnknownPeopleLocation = `
          SELECT zone_id, person_id, from
          FROM zone_people
          WHERE person_id IN ?
            AND is_known iS FALSE
            AND \`to\` IS NULL
          FOR UPDATE
        `
        console.debug('Locking unknown people locations')

        const query = conn.query(sqlLockUnknownPeopleLocation, [unknownPeopleIds])
          .then(results => {
            // update initial locations
            let queries = generateUpdateLocationQueries(results[0], peopleLocation, false)
            console.debug(queries)
            return conn.query(queries)
          })
          .catch(err => {
            throw err
          })

        return query.then(() => peopleLocation)
      })
      .then(peopleLocation => {
        // process remaining data
        const sqlInsertLocationData = `
          INSERT INTO zone_persons (person_id, is_known, from, \`to\`, worker_id)
          VALUES ?;
        `
        const data = []
        peopleLocation.forEach(locations => {
          if (locations.length > 1) {
            for (let i = 1; i < locations.length; i++) {
              // person_id, is_known, from, to, worker_id
              data.push([
                locations[i].person_id,
                locations[i].is_known,
                locations[i].from,
                locations[i].to,
                WORKER_ID
              ])
            }
          }
        })

        if (data.length > 0) {
          console.debug('Remaining location query: ' + mysql.format(sqlInsertLocationData, data))
          return conn.query(sqlInsertLocationData, data)
        }
      })
      .then(() => {
        // get latest locations of people based on the worker
        const sqlGetPeopleLocation = `
          SELECT
            zones.id AS zone_id,
            zp.person_id,
            is_known,
            from,
            to,
            zones.config AS config
          FROM zone_people zp
          JOIN zones ON zp.zone_id = zones.id
          WHERE worker_id = ?
            AND \`to\` IS NULL
        `
        return conn.query(sqlGetPeopleLocation, [WORKER_ID])
      })
      .then(([results]) => generateAlerts(results))
      .then(alertDetails => {
        console.info('Job finished. Marking as done...')
        // mark jobs as done.
        const sqlUpdateJobDone = `
          UPDATE face_logs_processed
          SET state = ?
          WHERE face_log_id IN ?
            AND worker_id = ?;
        `
        return conn.query(sqlUpdateJobDone, [JOB_STATE_DONE, faceLogIds, WORKER_ID])
          .then(() => conn.commit())
          .then(() => {
            // finished. print report
            const now = new Date()
            const secondsElapsed = (now.getTime() - startTime.getTime()) / 1000
            const totalAlertCount = Object.values(alertDetails).reduce((prev, curr) => prev + curr, 0)
            console.info(`
            Job finished at [${now.toISOString()}].
              Time Elapsed: ${secondsElapsed} s.
              Alerts generated: ${totalAlertCount}:
                - Unknown ${alertDetails.alertCounts.unknown}
                - Unauthorized ${alertDetails.alertCounts.unauthorized}
                - Overstay: ${alertDetails.alertCounts.overstay}`)
          })
          .catch(err => {
            throw err
          })
      })
    return secondTransaction
  })
}

main()
