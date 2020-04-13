const _ = require('lodash')
const Promise = require('bluebird')

const db = require('../config/db')
const blobToJpegBase64 = db.blobToJpegBase64

const NotFoundError = require('../utils/errors').NotFoundError

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
  JOIN zones z ON zg.id = z.zone_group_id
  WHERE LOWER(z.name) LIKE ?
  ORDER BY group_id, zone_id
  `
  const query = _.isString(zoneName) ? `%${zoneName.toLowerCase()}%` : '%%'
  return Promise.using(db.getConnection(), conn => conn.query(sql, [query])
    .then(([rows]) => rows.map(row => ({
      id: row.zone_id,
      name: row.zone_name,
      group_id: row.group_id,
      group_name: row.group_name
    }))))
}

/**
 * @typedef ZoneGroup
 * @type {object}
 * @property {number} id - ID of the group
 * @property {string} layout - URL/path to the layout image.
 * @property {string} name - name of the group.
 */
/**
 * @typedef ZoneGroupWithZones
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
 * @returns {Promise<Array<ZoneGroupWithZones>>}
 */
function getZoneGroupsWithPeopleCount () {
  const sql = `
SELECT
  zg.id AS group_id,
  zg.name AS group_name,
  zg.layout_src AS group_layout,
  z1.id AS zone_id,
  z1.name AS zone_name,
  current_persons_count,
  alert_type,
  has_alert
FROM zone_groups zg
JOIN zones z1 ON zg.id = z1.zone_group_id
JOIN (
  SELECT
    z.id,
   SUM(CASE WHEN zp.person_id IS NULL THEN 0 ELSE 1 END) AS current_persons_count
  FROM zones z
  LEFT JOIN zone_persons zp ON z.id = zp.zone_id AND zp.to IS NULL
  GROUP BY z.id
) zp1 ON zp1.id = z1.id
JOIN (
  SELECT
    zones.id,
    alert_type,
    za1.id IS NOT NULL AS has_alert
  FROM zones
  CROSS JOIN (
    SELECT 'A' alert_type UNION ALL SELECT 'U' UNION ALL SELECT 'O'
  ) alerts
  LEFT JOIN zone_alerts za1
    ON za1.id = (
      SELECT id
      FROM zone_alerts za2
      WHERE za2.zone_id = zones.id
        AND za2.type = alert_type
        AND is_dismissed IS FALSE
      LIMIT 1
    )
) zaf ON z1.id = zaf.id
ORDER BY group_id, zone_id, alert_type
  `
  return Promise.using(db.getConnection(), conn => conn.query(sql)
    .then(([rows]) => {
      const data = rows.reduce((prev, current) => {
        const data = prev || {}
        if (!_.has(data, current.group_id)) {
          data[current.group_id] = {
            id: current.group_id,
            name: current.group_name,
            layout: current.group_layout,
            zones: {}
          }
        }
        const zones = data[current.group_id].zones
        if (!_.has(zones, current.zone_id)) {
          zones[current.zone_id] = {
            id: current.zone_id,
            name: current.zone_name,
            persons_count: Number.parseInt(current.current_persons_count),
            alerts: { [current.alert_type]: Number.parseInt(current.has_alert) === 1 }
          }
        } else {
          zones[current.zone_id].alerts[current.alert_type] = Number.parseInt(current.has_alert) === 1
        }
        return data
      }, {})

      return Object.values(data).map(zoneGroup => {
        const current = zoneGroup
        current.zones = Object.values(current.zones)

        return current
      })
    })
    .catch(err => {
      console.error(err)
      throw err
    }))
}

function getZoneGroupsWithZone (zoneId = null) {
  const sql = `
SELECT
  zg.id AS group_id,
  zg.name AS group_name,
  zg.description AS group_description,
  zg.layout_src AS group_layout,
  zg.config AS group_config,
  zg.created_at AS group_created_at,
  zg.updated_at AS group_updated_at,
  z.id AS zone_id,
  z.name AS zone_name,
  z.description AS zone_description,
  z.config AS zone_config,
  z.created_at AS zone_created_at,
  z.updated_at AS zone_updated_at
FROM zone_groups zg
JOIN zones z ON z.zone_group_id = zg.id
${zoneId ? 'WHERE zg.id=?' : ''}
ORDER BY group_id, zone_id
  `
  return Promise.using(db.getConnection(), conn => (zoneId ? conn.query(sql, [zoneId]) : conn.query(sql))
    .then(([rows]) => {
      const data = rows.reduce((prev, current) => {
        const data = prev || {}
        if (!_.has(data, current.group_id)) {
          data[current.group_id] = {
            id: current.group_id,
            name: current.group_name,
            description: current.group_description,
            layout: current.group_layout,
            config: current.group_config,
            created_at: current.group_created_at,
            updated_at: current.group_updated_at,
            zones: []
          }
        }

        data[current.group_id].zones.push({
          id: current.zone_id,
          name: current.zone_name,
          description: current.zone_description,
          config: current.zone_config,
          created_at: current.zone_created_at,
          updated_at: current.zone_updated_at
        })
        return data
      }, {})

      return Object.values(data)
    }))
}

function getZoneGroup (zoneGroupId, conn) {
  const sql = 'SELECT * FROM zone_groups WHERE id = ?'
  const params = [zoneGroupId]

  return conn.query(sql, params)
    .then(([results]) => {
      if (results.length === 0) {
        throw new NotFoundError('ZoneGroup', zoneGroupId)
      }

      const zoneGroup = results[0]
      return {
        id: zoneGroup.id,
        name: zoneGroup.name,
        config: zoneGroup.config,
        layout: zoneGroup.layout_src,
        created_at: zoneGroup.created_at,
        updated_at: zoneGroup.updated_at
      }
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
    ORDER BY created_at DESC
  `
  const args = [zoneIds]

  if (!_.isNull(isDismissed)) {
    sql += 'AND is_dismissed = ?'
    args.push(isDismissed ? 1 : 0)
  }

  return Promise.using(db.getConnection(), conn => conn.query(sql, args)
    .then(([rows]) => {
      const data = {}
      rows.forEach(row => {
        const zoneId = row.zone_id.toString()
        if (!_.has(data, zoneId)) {
          data[zoneId] = []
        }
        const details = row.details
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
    }))
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
      AND zp.zone_id IN (?)
    ORDER BY zp.from
  `
  return Promise.using(db.getConnection(), conn => conn.query(sql, [zoneIds])
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
    }))
}

function dismissAlert (alertId) {
  const sql = `
    UPDATE zone_alerts
    SET is_dismissed = 1
    WHERE id = ?;
    SELECT * FROM zone_alerts WHERE id = ?
  `
  return Promise.using(db.getConnection(), conn => conn.query(sql, [alertId, alertId])
    .then(([results]) => {
      const alert = results[1][0]
      return {
        id: alert.id,
        type: alert.type,
        details: alert.details,
        created_at: alert.created_at.toISOString(),
        updated_at: alert.updated_at.toISOString(),
        person_id: alert.person_id,
        is_known: Number.parseInt(alert.is_known) === 1,
        is_dismissed: Number.parseInt(alert.is_dismissed) === 1
      }
    }))
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

  return Promise.using(db.getConnection(), conn => conn.query(sql, params)
    .then(([rows]) => rows.map(row => ({
      person_id: row.person_id,
      is_known: Number.parseInt(row.is_known) === 1,
      person_name: row.person_name,
      avatar: !_.isNull(row.person_portrait) ? blobToJpegBase64(row.person_portrait) : null,
      from: row.from.toISOString(),
      to: row.to.toISOString()
    }))))
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

  return Promise.using(db.getConnection(), conn => conn.query(sql, params)
    .then(([rows]) => rows.map(row => ({
      person_id: row.person_id,
      is_known: Number.parseInt(row.is_known) === 1,
      person_name: row.person_name,
      avatar: !_.isNull(row.person_portrait) ? blobToJpegBase64(row.person_portrait) : null,
      from: row.from.toISOString(),
      to: _.isNull(row.to) ? null : row.to.toISOString()
    }))))
}

function getPeopleCountHourlyInZone (zoneId, date) {
  const sql = `
  SELECT
    ts_hour,
    SUM(CASE WHEN person_id IS NULL THEN 0 ELSE 1 END) AS persons_count
  FROM(
    SELECT
      v.ts_hour,
      zpf.person_id,
      zpf.is_known
    FROM
    -- generates a series of hourly timestamp, from beginning of UNIX epoch up to 2084-01-29 15:00:00
    (select TIMESTAMPADD(HOUR, t5.i*100000 + t4.i*10000 + t3.i*1000 + t2.i*100 + t1.i*10 + t0.i, '1970-01-01 00:00:00') ts_hour from
        (select 0 i union all select 1 union all select 2 union all select 3 union all select 4 union all select 5 union all select 6 union all select 7 union all select 8 union all select 9) t0,
        (select 0 i union all select 1 union all select 2 union all select 3 union all select 4 union all select 5 union all select 6 union all select 7 union all select 8 union all select 9) t1,
        (select 0 i union all select 1 union all select 2 union all select 3 union all select 4 union all select 5 union all select 6 union all select 7 union all select 8 union all select 9) t2,
        (select 0 i union all select 1 union all select 2 union all select 3 union all select 4 union all select 5 union all select 6 union all select 7 union all select 8 union all select 9) t3,
        (select 0 i union all select 1 union all select 2 union all select 3 union all select 4 union all select 5 union all select 6 union all select 7 union all select 8 union all select 9) t4,
        (select 0 i union all select 1 union all select 2 union all select 3 union all select 4 union all select 5 union all select 6 union all select 7 union all select 8 union all select 9) t5) v
    LEFT JOIN
    (
    SELECT
      person_id,
      is_known,
      TIMESTAMP(DATE_FORMAT(zp.\`from\`, '%Y-%m-%d %H:00:00')) AS ts_from,
      TIMESTAMP(DATE_FORMAT(zp.\`to\`, '%Y-%m-%d %H:00:00')) AS ts_to
    FROM zone_persons zp
    WHERE zone_id = ?
    AND ((DATE(zp.\`from\`) >= ? AND DATE(zp.\`to\`) <= ?)
      OR (DATE(zp.\`from\`) <= ? AND zp.\`to\` IS NULL))
    ) zpf ON ((ts_hour BETWEEN ts_from AND ts_to) OR (ts_hour >= ts_from AND ts_to IS NULL))
    WHERE ts_hour BETWEEN ? AND ?
    GROUP BY v.ts_hour, zpf.person_id, zpf.is_known -- count hourly as 1
  ) a
  GROUP BY ts_hour
  ORDER BY ts_hour;
  `
  const tsStart = `${date} 00:00:00`
  const tsEnd = `${date} 23:00:00`
  const params = [zoneId, date, date, date, tsStart, tsEnd]

  return Promise.using(db.getConnection(), conn => conn.query(sql, params)
    .then(([rows]) => rows.map(row => ({
      hour: row.ts_hour,
      persons_count: Number.parseInt(row.persons_count)
    }))))
}

function editZone (zoneId, zoneData) {
  let promise
  const zoneGroup = zoneData.zone_group
  if (_.isObjectLike(zoneGroup)) {
    promise = createZoneGroup(zoneGroup)
  }

  const sql = `
    UPDATE zones
    SET name = ?, description = ?, config = ?, zone_group_id = ?, updated_at = now()
    WHERE id = ?;
    SELECT * FROM zones WHERE id = ?
  `

  const params = [
    zoneData.name,
    zoneData.description,
    JSON.stringify(zoneData.config)
  ]
  if (_.isUndefined(promise)) {
    params.push(zoneGroup)
    params.push(zoneId)
    params.push(zoneId)

    let existingZoneGroup
    promise = Promise.using(db.getConnection(), conn => getZoneGroup(zoneGroup, conn)
      .then(zoneGroup => {
        existingZoneGroup = zoneGroup
        return Promise.using(db.getConnection(), conn => conn.query(sql, params))
      })
      .then(([result]) => ({ result: result[1][0], zoneGroup: existingZoneGroup })))
  } else {
    promise.then(newZoneGroup => {
      params.push(newZoneGroup.id)
      params.push(zoneId)
      params.push(zoneId)
      return Promise.using(db.getConnection(), conn => conn.query(sql, params)
        .then(([result]) => ({ result: result[1][0], zoneGroup: newZoneGroup })))
    })
  }
  return promise.then(({ result, zoneGroup }) => {
    const data = result

    data.created_at = data.created_at.toISOString()
    data.updated_at = data.updated_at.toISOString()
    delete data.zone_group_id
    data.zone_group = zoneGroup

    return data
  })
}

function getZone (id) {
  const sql = 'SELECT * FROM zones WHERE id = ?'
  const params = [id]
  return Promise.using(db.getConnection(), conn => conn.query(sql, params)
    .then(([result]) => {
      if (result.length === 0) {
        throw new NotFoundError('Zone', id)
      }
      return result[0]
    }))
}

function createZone (zoneData) {
  let promise
  const zoneGroup = zoneData.zone_group
  if (_.isObjectLike(zoneGroup)) {
    promise = createZoneGroup(zoneGroup)
  }

  const sql = `
    INSERT INTO zones (name, description, config, zone_group_id, created_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
    SELECT * FROM zones WHERE id = (SELECT LAST_INSERT_ID())
  `
  const params = [
    zoneData.name,
    zoneData.description,
    JSON.stringify(zoneData.config)
  ]

  if (_.isUndefined(promise)) {
    // zoneGroup contains ID.

    let existingZoneGroup
    promise = Promise.using(db.getConnection(), conn => /* check if the zone group exists */ getZoneGroup(zoneGroup, conn)
      .then(zoneGroup => {
        existingZoneGroup = zoneGroup
        params.push(zoneGroup.id)
        return Promise.using(db.getConnection(), conn => conn.query(sql, params))
      })
      .then(([result]) => ({ result: result[1][0], zoneGroup: existingZoneGroup })))
  } else {
    // a new zone group has been created. create a data based on this
    promise.then(newZoneGroup => {
      params.push(newZoneGroup.id)
      return Promise.using(db.getConnection(), conn => conn.query(sql, params)
        .then(([result]) => ({ result: result[1][0], zoneGroup: newZoneGroup })))
    })
  }
  return promise.then(({ result, zoneGroup }) => {
    const data = result

    data.created_at = data.created_at.toISOString()
    data.updated_at = data.updated_at.toISOString()
    delete data.zone_group_id
    data.zone_group = zoneGroup

    return data
  })
}

function editZoneGroup (id, zoneGroupData) {
  const sql = `
    UPDATE zone_groups
    SET name = ?, description = ?, layout_src = COALESCE(?, layout_src), config = ?
    WHERE id = ?
  `
  const params = [
    zoneGroupData.name,
    zoneGroupData.description,
    zoneGroupData.layout,
    JSON.stringify(zoneGroupData.config),
    id, id
  ]

  return Promise.using(db.getConnection(), conn => conn.query(sql, params)
    .then(() => getZoneGroupsWithZone(id).then(result => result[0])))
}

function createZoneGroup (zoneGroupData) {
  const sql = `
    INSERT INTO zone_groups (name, description, layout_src, config, created_at)
    VALUES (?, ?, ?, ?, now());
    SELECT * FROM zone_groups WHERE id = (SELECT LAST_INSERT_ID())
  `
  const params = [
    zoneGroupData.name,
    zoneGroupData.description,
    zoneGroupData.layout,
    JSON.stringify(zoneGroupData.config)
  ]

  return Promise.using(db.getConnection(), conn => conn.query(sql, params)
    .then(([result]) => {
      const data = result[1][0]
      return getZoneGroupsWithZone(data.id)
        .then(result => result[0])
    }))
}

module.exports = {
  getZones,
  getZoneGroupsWithPeopleCount,
  getZoneGroupsWithZone,
  createZone,
  getZone,
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
