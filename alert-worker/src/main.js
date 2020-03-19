const mysql = require('mysql2/promise')
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
    const isKnown = intval(row.is_known) === 1
    const personId = isKnown ? `${row.person_id}` : `U-${row.person_id}`
    if (!peopleCurrentZone.has(personId)) {
      peopleCurrentZone.set(personId, {
        zone_id: row.zone_id,
        is_known: isKnown ? '1' : '0',
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
          is_known: isKnown ? '1' : '0',
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
      is_known: isKnown ? '1' : '0',
      zone_id: currentLocationData.zone_id,
      from: currentLocationData.from,
      to: null
    })
  })

  return peopleLocationData
}


const JOB_STATE_PROCESSING = 'P'
const JOB_STATE_DONE = 'D'
function main () {
  const workerId = process.env.WORKER_ID
  const con = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
  })
  .then(conn => {
    // first transaction: get job, mark as PROCESSING
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
        // collect data, generate UPDATE and INSERT statement
        const faceLogIds = rows.map(r => [r.face_log_id, JOB_STATE_PROCESSING, workerId])
        const sql2 = `INSERT INTO face_logs_processed (face_log_id, state, worker_id) VALUES ?`

        conn.query(sql2, [faceLogIds])
          .then(() => conn.commit())

        return rows
      })
      .catch(err => {
        console.error(err)
        throw err
      })

    // second transaction: get the person's location, update, and generate alert.
    let peopleLocation
    const secondTransaction = firstTransaction
      .then(rows => {
        peopleLocation = collectPeopleData(rows)
        return conn.beginTransaction()
      })
      .then(() => {
        const data = []
        const initLocation = []
        peopleLocation.forEach(locations => {
          // person_id, is_known, from, to, worker_id
          initLocation.push([location[0].person_id, location[0].is_known, location[0].from, location[0].to, workerId])
          if (locations.length > 1) {
            locations.forEach((location, idx) => {
              if (idx === 0) {
                return
              }
              data.push([location.person_id, location.is_known, location.from, location.to, workerId])
            })
          }
        })

        // update each initial location. insert if not exists
        // TODO query
        const sqlUpdateInitialLocation = ''
      })
  })
}
