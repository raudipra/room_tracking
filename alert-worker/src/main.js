const mysql = require('mysql2/promise')
const _ = require('lodash')
require('dotenv').config()

/**
 * Steps:
 * 1. Get latest data from DB, order by most recent. process everything not in the `face_logs_processed` table. Get from the beginning of time, chunk N number of data at a time.
 * 2. generate person's location(s) as per the timeline.
 *  a. collect to "person_id": Array<{ "zone_id", "from", "to" }>
 * 3. Update person's location.
 * 4. Generate alert based on existing
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
        firstLocationData.to, workerId
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
            firstLocationData.from, workerId, row.person_id
          ])
          queries += mysql.format(sqlInsertInitialLocation, [
            row.person_id, firstLocationData.from,
            firstLocationData.to, workerId
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
            firstLocationData.to, workerId, row.person_id
          ])
        } else { // different zone
          // person moved from initial location.
          if (fromFaceLog >= fromExisting) {
            queries += mysql.format(sqlUpdateInitialLocation, [
              firstLocationData.from, workerId, row.person_id
            ])
          } else {
            queries += mysql.format(sqlUpdateInitialLocation, [
              row.from, workerId, row.person_id
            ])
          }
          queries += mysql.format(sqlInsertInitialLocation, [
            row.person_id, firstLocationData.from,
            firstLocationData.to, workerId
          ])
        }
      }
    }
  })
  return queries
}

function generateAlerts (latestPeopleLocationWithZoneConfig) {
  // TODO
}

const JOB_STATE_PROCESSING = 'P'
const JOB_STATE_DONE = 'D'
function main () {
  const workerId = process.env.WORKER_ID
  const startTime = new Date()
  const faceLogIds = []
  const con = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multipleStatements: true
  })
  .then(conn => {
    // first transaction: get job, mark as PROCESSING
    let firstTransactionCompleted = false
    const firstTransaction = conn.beginTransaction()
      .then(() => {
        console.debug('Getting face logs data')
        const sql = `
        SELECT
          fl.id AS face_log_id,
          c.zone_id,
          TIMESTAMP(fl.creation_time) AS creation_time,
          (fl.unknown_person_id IS NULL) AS is_known,
          (CASE WHEN fl.unknown_person_id IS NOT NULL THEN fl.unknown_person_id
          ELSE fl.person
          END) AS person_id
        FROM face_logs fl
        LEFT JOIN face_logs_processed flp ON fl.id = flp.face_log_id
        JOIN cameras c ON fl.camera_name = c.name
        WHERE flp.state IS NULL
        ORDER BY creation_time
        LIMIT 5000
        FOR UPDATE;
        `
        return conn.query(sql)
      })
      .then(rows => {
        // collect data, mark face_logs_id as processing
        faceLogIds.push(...rows.map(r => r.face_log_id))
        const sql2 = `INSERT INTO face_logs_processed (face_log_id, state, worker_id) VALUES ?`

        conn.query(sql2, [rows.map(r => [r.face_log_id, JOB_STATE_PROCESSING, workerId])])
          .then(() => conn.commit())
          .then(() => {
            console.debug('first transaction done.')
            firstTransactionCompleted = true
          })
          .catch(err => {
            throw err
          })

        return rows
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
        peopleLocation = collectPeopleData(rows)
        const knownPeopleIds = []
        const unknownPeopleIds = []
        rows.forEach((locations, personId) => {
          if (!personId.includes('U-')) {
            knownPeopleIds.push(personId)
          } else {
            unknownPeopleIds.push(personId.substring(2))
          }
        })
        console.debug('Starting second transaction')
        return {
          query: conn.beginTransaction(),
          peopleLocation,
          knownPeopleIds,
          unknownPeopleIds
        }
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

        // set current locations of known people, using data on first row.
        const query = conn
          .query(sqlLockPeople, [knownPeopleIds])
          .then(results => {
            let queries = generateUpdateLocationQueries(results, peopleLocation, true)
            console.debug(queries)
            return {
              query: conn.query(queries)
            }
          })
          .catch(err => {
            throw err
          })
        return { query, peopleLocation, unknownPeopleIds }
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

        const query = conn.query(sqlLockUnknownPeopleLocation, [unknownPeopleIds])
          .then(results => {
            // update initial locations
            let queries = generateUpdateLocationQueries(results, peopleLocation, false)
            console.debug(queries)
            return conn.query(queries)
          })
          .catch(err => {
            throw err
          })

        return { query, peopleLocation }
      })
      .then(({ query, peopleLocation }) => {
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
                workerId
              ])
            }
          }
        })

        if (data.length > 0) {
          return query.then(() => {
            // generate people locaton
            return conn.query(sqlInsertLocationData, data)
          })
        } else {
          return query
        }
      })
      .then(() => {
        // get latest locations of people based on the worker
        const sqlGetPeopleLocation = `
          SELECT
            zones.id,
            zp.person_id,
            is_known,
            from,
            to,

          FROM zone_people zp
          JOIN zones ON zp.zone_id = zones.id
          WHERE worker_id = ?
            AND \`to\` IS NULL
        `
        return conn.query(sqlGetPeopleLocation, )
      })
      .then(generateAlerts)
      .then(alertDetails => {
        console.log()
        // mark jobs as done.
        const sqlUpdateJobDone = `
          UPDATE face_logs_processed
          SET state = ?
          WHERE face_log_id IN ?
            AND worker_id = ?
        `
        return conn.query(sqlUpdateJobDone, [JOB_STATE_DONE, faceLogIds, workerId])
          .then(() => conn.commit())
          .then(() => {
            const elapsed = ((new Date()) - startTime.getTime()) / 1000
            const alertCount = Object.values(alertDetails).reduce((prev, curr) => prev + curr, 0)
            console.info(`
            Job done.
              Time Elapsed: ${elapsed} s.
              Alerts generated: ${alertCount}:
                -
                -
                - `)
          })
          .catch(err => {
            throw err
          })
      })
  })
}

main()
