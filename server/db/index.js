const mysql = require('mysql2/promise')
const _ = require('lodash')
const faker = require('faker')
const DateTime = require('luxon').DateTime

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

const DATETIME_FORMAT = 'yyyy-LL-dd HH:mm:ss'
/**
 * Converts a JS {@link Date} to SQL DateTime string
 * @param {?Date} dateTime
 * @returns {?string} SQL-formatted DateTime
 */
function formatDateTime (dateTime) {
  if (_.isUndefined(dateTime) || _.isNull(dateTime)) return null

  return DateTime.fromJSDate(dateTime).toFormat(DATETIME_FORMAT)
}

function blobToJpegBase64 (blob) {
  return 'data:image/jpeg;' + Buffer.from(blob).toString('base64')
}

/**
 * @typedef ZoneWithGroup
 * @type {object}
 * @property {number} id - ID of the zone.
 * @property {string} name - name of the zone.
 * @property {number} group_id - ID of the zone group.
 * @property {string} group_name - name of the zone group.
 */
/**
 * Get list of zones
 * @param {?string} zoneName - name of the zone to be queried
 * @return {Promise<Array<ZoneWithGroup>>}
 */
function getZones (zoneName) {
  const sql = `
  SELECT
    zg.id AS group_id,
    zg.name AS group_name,
    z.id AS zone_id,
    z.name AS zone_name
  FROM zone_groups zg
  JOIN zones z ON zg.id = z.group_id
  WHERE LOWER(z.name) LIKE ?
  ORDER BY group_id, zone_id
  `
  const query = _.isString(zoneName) ? `%${zoneName.toLowerCase()}%` : '%%'
  return pool.query(sql, [query])
    .then(([rows]) => rows.map(row => ({
      id: row.zone_id,
      name: row.zone_name,
      group_id: row.group_id,
      group_name: row.group_name
    })))
}

/**
 * @typedef ZoneGroup
 * @type {object}
 * @property {number} id - ID of the group
 * @property {string} layout - URL/path to the layout image.
 * @property {string} name - name of the group.
 * @property {Array<ZoneWithPersonsCount>} zones - zones inside the group.
 */
/**
 * @typedef ZoneWithPersonsCount
 * @type {object}
 * @property {number} id - ID of the zone.
 * @property {string} name - name of the zone.
 * @property {number} persons_count - number of persons in the zone
 */
/**
 * Get groups of zones, including the number of persons currently inside each zone.
 * @returns {Promise<Array<ZoneGroup>>}
 */
function getZoneGroups () {
  const sql = `
    SELECT
      zg.id AS group_id,
      zg.name AS group_name,
      zg.layout_src AS group_layout,
      z.id AS zone_id,
      z.name AS zone_name,
      SUM(CASE WHEN zp.person_id IS NULL THEN 0 ELSE 1 END) AS current_persons_count
    FROM zone_groups zg
    JOIN zones z ON zg.id = z.group_id
    LEFT JOIN zone_persons zp ON z.id = zp.zone_id AND zp.to IS NULL
    GROUP BY group_id, group_name, group_layout, zone_id, zone_name
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
              name: current.zone_name,
              persons_count: current.current_persons_count
            }]
          }
        } else {
          data[current.group_id].zones.push({
            id: current.zone_id,
            name: current.zone_name,
            persons_count: current.current_persons_count
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
    WHERE za.zone_id IN (?)
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

/**
 *
 * @param {!number|string} zoneId
 * @param {!string} date
 */
function getPeopleInZoneByDate (zoneId, date) {
  const sql = `
    SELECT
      zp.person_id,
      zp.is_known,
      zp.from,
      zp.to,
      p.name AS person_name,
      p.portrait AS person_portrait
    FROM zone_persons zp
    LEFT JOIN persons p ON zp.is_known IS TRUE AND zp.person_id = p.id
    WHERE zp.zone_id = ?
      AND (DATE(zp.from) = ? OR DATE(zp.to) = ?)
    ORDER BY zp.from
  `
  const params = [zoneId, date]

  return pool.getConnection()
    .then(conn => conn.query(sql, params))
    .then(([rows]) => rows.map(row => ({
      person_id: row.person_id,
      is_known: Number.parseInt(zp.is_known) === 1,
      person_name: row.person_name,
      avatar: !_.isNull(row.person_portrait) ? blobToJpegBase64(row.person_portrait) : null,
      from: formatDateTime(row.from),
      to: formatDateTime(row.to)
    })))
}

function getPeopleInZoneByDateTimeRange (zoneId, dateTimeFrom, dateTimeTo) {
  const sql = `
    SELECT
      zp.person_id,
      zp.is_known,
      zp.from,
      zp.to,
      p.name AS person_name,
      p.portrait AS person_portrait
    FROM zone_persons zp
    LEFT JOIN persons p ON zp.is_known IS TRUE AND zp.person_id = p.id
    WHERE zp.zone_id = ?
      AND ((zp.from >= ? AND zp.to <= ?) OR (zp.from <= ? AND zp.to IS NULL))
    ORDER BY zp.from
  `
  const params = [zoneId, dateTimeFrom, dateTimeTo, dateTimeTo]

  return pool.getConnection()
    .then(conn => conn.query(sql, params))
    .then(([rows]) => rows.map(row => ({
      person_id: row.person_id,
      is_known: Number.parseInt(zp.is_known) === 1,
      person_name: row.person_name,
      avatar: !_.isNull(row.person_portrait) ? blobToJpegBase64(row.person_portrait) : null,
      from: formatDateTime(row.from),
      to: formatDateTime(row.to)
    })))
}

function getPeopleCountHourlyInZone (zoneId, date) {
  const sql = `
    SELECT
    FROM
  `
  // TODO
  const data = {}
  for (let i = 0; i <= 24; i++) {
    const hour = `${('0' + i).slice(-2)}:00`
    data[hour] = faker.random.number({ min: 0, max: 50, precision: 0 })
  }

  return Promise.resolve(data)
}

function editZone (zoneId, zoneData) {
  let promise
  const zoneGroup = zoneData.zone_group
  if (_.isObjectLike(zoneGroup)) {
    promise = createZoneGroup(zoneGroup)
  }

  const sql = `
    UPDATE zones
    SET name = ?, description = ?, config = ?, zone_group_id = ?
    WHERE id = ?
  `
}

function createZone (zoneData) {
  let promise
  const zoneGroup = zoneData.zone_group
  if (_.isObjectLike(zoneGroup)) {
    promise = createZoneGroup(zoneGroup)
  }

  const sql = `
    INSERT INTO zones (name, description, config, zone_group_id)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `
  const params = [
    zoneData.name,
    zoneData.description,
    JSON.stringify({
      is_active: zoneData.is_active,
      overstay_limit: zoneData.overstay_limit
    })
  ]

  if (_.isUndefined(promise)) {
    // zoneGroup contains ID.
    params.push(zoneGroup)
    promise = pool.query(sql, params)
  } else {
    // a new zone group has been created. create a data based on this
    promise.then(newZoneGroup => {
      params.push(newZoneGroup.id)
      return pool.query(sql, params)
    })
  }
  return promise.then(([result]) => result[0])
}

function editZoneGroup (id, zoneGroupData) {
  const sql = `
    UPDATE zone_groups
    SET name = ?, description = ?, layout_src = ?, config = ?
    WHERE id = ?
    RETURNING *
  `
  const params = [
    zoneGroupData.name,
    zoneGroupData.description,
    zoneGroupData.layout,
    JSON.stringify(zoneGroupData.config),
    id
  ]

  return pool.getConnection()
    .then(c => c.query(sql, params))
    .then(([rows]) => ({
      id: rows[0].id,
      name: rows[0].name,
      description: rows[0].description,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      layout: rows[0].layout_src,
      config: rows[0].config
    }))
}

function createZoneGroup (zoneGroupData) {
  const sql = `
    INSERT INTO zone_groups (name, description, layout_src, config)
    VALUES (?, ?, ?, ?)
    RETURNING *
  `
  const params = [
    zoneGroupData.name,
    zoneGroupData.description,
    zoneGroupData.layout,
    JSON.stringify(zoneGroupData.config)
  ]

  return pool.getConnection()
    .then(c => c.query(sql, params))
    .then(([rows]) => ({
      id: rows[0].id,
      name: rows[0].name,
      description: rows[0].description,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      layout: rows[0].layout_src,
      config: rows[0].config
    }))
}

module.exports = {
  getZones,
  getZoneGroups,
  createZone,
  editZone,
  createZoneGroup,
  editZoneGroup,
  getAlerts,
  getPeopleInZones,
  getPeopleInZoneByDate,
  getPeopleInZoneByDateTimeRange,
  getPeopleCountHourlyInZone,
  dismissAlert
}
