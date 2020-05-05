const EventEmitter = require('events')
const mysql = require('mysql2/promise')
const _ = require('lodash')
const Promise = require('bluebird')
const { DateTime, Duration } = require('luxon')

// load local files
const db = require('./utils/db')
const logger = require('./utils/logger')('alert-generator')
const LocationUpdater = require('./location-update')
const DATETIME_FORMAT = require('./utils/date-time').DEFAULT_SQL_DATETIME_FORMAT
const ALERT_TYPES = require('./alert-types')
const WORKER_ID = process.env.WORKER_ID || 'worker'

const AlertGenerator = {
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

LocationUpdater.events.on('finish', () => {
  if (AlertGenerator.isRunning()) {
    return
  }
  AlertGenerator.run()
})

function generateAlerts (results, conn, timestamp) {
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
      alertQueryPromises.push(generateAlertQuery(timestamp, row, ALERT_TYPES.UNKNOWN))
    }

    // alert 2: person is unauthorized
    if (_.has(zone, 'config.is_active')) {
      if (!zone.config.is_active) {
        alertQueryPromises.push(generateAlertQuery(timestamp, row, ALERT_TYPES.UNAUTHORIZED))
      }
    }

    // alert 3: overstay
    if (_.has(zone, 'config.overstay_limit')) {
      const overstayLimit = zone.config.overstay_limit
      const parts = overstayLimit.split(':') // HH:MM
      const overstayLimitDuration = Duration.fromObject({
        hours: Number.parseInt(parts[0]),
        minutes: Number.parseInt(parts[1])
      })
      const atZoneFrom = DateTime.fromSQL(row.from)

      if (atZoneFrom.diff(now) > overstayLimitDuration) {
        alertQueryPromises.push(generateAlertQuery(timestamp, row, ALERT_TYPES.OVERSTAY))
      }
    }
  })

  if (alertQueryPromises.length === 0) {
    logger.warn('No alert to generate.')
    return { unknownPerson: 0, unauthorized: 0, overstay: 0 }
  }

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
    }, { queries: '', alertCounts: { unknownPerson: 0, unauthorized: 0, overstay: 0 } }))
    .then(results => {
      if (results.queries !== '') {
        return conn.query(results.queries)
      }
    })
    .then(() => results.alertCounts)
}

/**
 * Generates alert query, if the alert has been generated after a predefined backoff period.
 * @param {DateTime} timestamp base timestamp for backoff calculation
 * @param {{ from: DateTime, zone_id: Number, person_id: Number, is_known: Boolean }} personDetails details of the person
 * @param {string} alertType type of alert to be generated
 * @returns {Promise<{ alertType: ?string, query: string }>}
 */
function generateAlertQuery (timestamp, personDetails, alertType) {
  const DEFAULT_BACKOFF = 10
  let backoffParam
  switch (alertType) {
    case ALERT_TYPES.UNKNOWN:
      backoffParam = process.env.ALERT_UNKNOWN_BACKOFF || DEFAULT_BACKOFF
      break
    case ALERT_TYPES.UNAUTHORIZED:
      backoffParam = process.env.ALERT_UNAUTHORIZED_BACKOFF || DEFAULT_BACKOFF
      break
    case ALERT_TYPES.OVERSTAY:
      backoffParam = process.env.ALERT_OVERSTAY_BACKOFF || DEFAULT_BACKOFF
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
    const sqlInsertAlert = `
      INSERT INTO zone_alerts (id, zone_id, type, details, person_id, is_known, worker_id)
      VALUES (uuid(), ?, ?, ?, ?, ?, ?);
    `
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

function main () {
  const personLocations = []
  const startTime = new Date()

  logger.info('Starting alert generator...')
  return db.withTransaction(conn => {
    // get latest person data, chunked
    AlertGenerator.events.emit('start')
    logger.debug('Getting latest person data')
    const sql = `
    SELECT
      zp.zone_id AS zone_id,
      zp.person_id AS person_id,
      zp.is_known AS is_known,
      zp.\`from\` AS \`from\`,
      z.config AS config
    FROM zone_persons zp
    JOIN zones z ON z.id = zp.zone_id
    WHERE worker_updated_at = ?
      AND zp.\`to\` IS NULL
      AND zp.updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) -- ignore location updates that has been stale, i.e. no update for one day.
    `
    return conn.query(sql, [WORKER_ID])
      .then(([results]) => {
        personLocations.push(...results.map(r => Object.assign(r, { from: DateTime.fromJSDate(r.from) })))
        logger.debug('generating alerts.')
        return generateAlerts(results, conn, DateTime.fromJSDate(startTime))
      })
      .then(alertDetails => {
        // finished. print report
        const now = new Date()
        const secondsElapsed = (now.getTime() - startTime.getTime()) / 1000
        const meta = { secondsElapsed, alertDetails }
        const totalAlertCount = Object.values(alertDetails).reduce((prev, curr) => prev + curr, 0)
        logger.info(`${totalAlertCount} alert(s) generated in ${secondsElapsed} second(s). Unknown: ${alertDetails.unknownPerson}. Unauthorized: ${alertDetails.unauthorized}. Overstay: ${alertDetails.overstay}`, meta)
        AlertGenerator.events.emit('finish', meta)
      })
  })
}

Object.freeze(AlertGenerator)
module.exports = AlertGenerator
