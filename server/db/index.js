const mysql = require('mysql2/promise')
const _ = require('lodash')
const faker = require('faker')

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 2
})

function blobToJpegBase64 (blob) {
  return 'data:image/jpeg;' + Buffer.from(blob).toString('base64')
}

/**
 * Get zones contained within a zone group, with
 * @returns {Promise<{ id: Number,  }>}
 */
function getZoneGroups () {
  const sql = `
    SELECT
      zg.id AS group_id,
      zg.name AS group_name,
      zg.layout_src AS group_layout,
      z.id AS zone_id,
      z.name AS zone_name
    FROM zone_groups zg
    JOIN zones z ON zg.id = z.group_id
    ORDER BY group_id, zone_id
  `
  return pool.query(sql)
    .then(([rows]) => {
      const data = rows.reduce((prev, current) => {
        const data = prev || {}
        if (!_.has(data, current.group_id)) {
          data[current.group_id] = {
            id: current.group_id,
            name: current.group_name,
            layout: current.group_layout,
            zones: [{
              id: current.zone_id,
              name: current.zone_name
            }]
          }
        } else {
          data[current.group_id].zones.push({
            id: current.zone_id,
            name: current.zone_name
          })
        }
        return data
      }, {})

      return Object.values(data)
    })
    .catch(err => {
      console.error(err)
      throw err
    })
}

function getAlerts (zoneIds, isDismissed = null) {
  // get 24 hours from now
  let sql = `
    SELECT
      za.id,
      za.zone_id,
      type,
      details,
      za.created_at,
      za.updated_at,
      person_id,
      is_known,
      is_dismissed,
      p.name AS person_name,
      p.portrait
    FROM zone_alerts za
    LEFT JOIN persons p ON za.person_id = p.id AND za.is_known = 1
    WHERE za.zone_id IN ()
      AND za.created_at BETWEEN DATE_SUB(now(), INTERVAL 24 HOUR) AND now()
    ORDER BY created_at DESC
  `
  const args = [zoneIds]

  if (!_.isNull(isDismissed)) {
    sql += 'AND is_dismissed = ?'
    args.push(isDismissed ? 1 : 0)
  }

  return pool.query(sql, args)
    .then(([rows]) => {
      const data = {}
      rows.forEach(row => {
        const zoneId = row.zone_id.toString()
        if (!_.has(data, zoneId)) {
          data[zoneId] = []
        }
        const details = JSON.parse(row.details)
        data[zoneId].push({
          id: row.id,
          type: row.type,
          created_at: row.created_at,
          updated_at: row.updated_at,
          is_dismissed: Number.parseInt(row.is_dismissed) === 1,
          person: {
            id: row.person_id,
            is_known: Number.parseInt(row.is_known) === 1,
            from: details.from || row.created_at,
            avatar: !_.isNull(row.portrait) ? blobToJpegBase64(row.portrait) : null
          }
        })
      })
      zoneIds.forEach(id => {
        const zoneId = id.toString()
        if (!_.has(data, zoneId)) {
          data[zoneId] = []
        }
      })
      return data
    })
}

function getPeopleInZones (zoneIds) {
  const sql = `
    SELECT
      COALESCE(p.id, zp.person_id) AS id,
      zp.is_known,
      zp.from,
      p.name,
      p.portrait
    FROM zone_persons zp
    LEFT JOIN persons p ON zp.person_id = p.id AND zp.is_known = 1
    WHERE zp.to IS NULL
      AND zp.id IN (?)
    ORDER BY zp.from
  `
  return pool.query(sql, [zoneIds])
    .then(([rows]) => rows.map(row => {
      return {
        id: row.id,
        is_known: Number.parseInt(row.is_known) === 1,
        from: row.from,
        name: row.name,
        avatar: !_.isNull(row.portrait) ? blobToJpegBase64(row.portrait) : null,
        alerts: []
      }
    }))
    .catch(err => {
      console.error(err)
      throw err
    })
}

function dismissAlert (alertId) {
  const sql = `
    UPDATE zone_alerts
    SET is_dismissed = 1
    WHERE id = ?
    RETURNING id, type, details, created_at, updated_at, person_id, is_known, is_dismissed
  `
  return pool.query(sql, [alertId])
    .then(([results]) => {
      const alert = results[0]
      return {
        id: alert.id,
        type: alert.type,
        details: JSON.parse(alert.details),
        created_at: alert.created_at,
        updated_at: alert.updated_at,
        person_id: alert.person_id,
        is_known: Number.parseInt(alert.is_known) === 1,
        is_dismissed: Number.parseInt(alert.is_dismissed) === 1
      }
    })
}

function getPeopleInZoneWithin (zoneId, date, fromHour, toHour) {
  // TODO stub
  return Promise.resolve([])
}

function getPeopleCountHourlyInZone (zoneId, date) {
  // TODO
  const data = {}
  for (let i = 0; i <= 24; i++) {
    const hour = `${('0' + i).slice(-2)}:00`
    data[hour] = faker.random.number({ min: 0, max: 50, precision: 0 })
  }

  return Promise.resolve(data)
}

module.exports = {
  getZoneGroups,
  getAlerts,
  getPeopleInZones,
  getPeopleInZoneWithin,
  getPeopleCountHourlyInZone,
  dismissAlert
}
