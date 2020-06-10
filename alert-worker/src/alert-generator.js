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

let isRunning = false
const AlertGenerator = {
  run: function () {
    if (isRunning) {
      return
    }
    isRunning = true
    main()
      .then(() => null)
      .catch(err => {
        logger.error(err)
        LocationUpdater.events.emit('error', err)
      })
      .finally(function () {
        isRunning = false
      }.bind(this))
    return null
  },
  isRunning: function () {
    return isRunning
  },
  events: new EventEmitter()
}

LocationUpdater.events.on('finish', () => {
  if (isRunning) {
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

      if (atZoneFrom.diff(timestamp) > overstayLimitDuration) {
        alertQueryPromises.push(generateAlertQuery(timestamp, row, ALERT_TYPES.OVERSTAY))
      }
    }
  })

  if (alertQueryPromises.length === 0) {
    logger.warn('No alert to generate.')
    return Promise.resolve({ unknownPerson: 0, unauthorized: 0, overstay: 0 })
  }

  return Promise.all(alertQueryPromises)
    .then(results => results.reduce((prev, next) => {
      let queries = prev.queries || ''
      let alertUnknownPersonCount = _.has(prev, 'alertCounts.unknownPerson') ? prev.alertCounts.unknownPerson : 0
      let alertUnauthorizedCount = _.has(prev, 'alertCounts.unauthorized') ? prev.alertCounts.unauthorized : 0
      let alertOverstayCount = _.has(prev, 'alertCounts.overstay') ? prev.alertCounts.overstay : 0

      if (next.query !== '') {
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
        logger.debug('Executing update query')
        return conn.query(results.queries).then(() => results.alertCounts)
      } else {
        logger.debug('No query to execute')
        return results.alertCounts
      }
    })
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
  return Promise.using(db.getBackoffConnection(), conn => conn.query(sqlCheckExistingAlert,
    [personDetails.zone_id, personDetails.person_id, personDetails.is_known, alertType, minTimestamp]
  ).then(([result]) => {
    /**
     * This is how the result from MySQL is represented by this library
     * [Array<TextRow>, Array<ColumnDefinition>]
     * with TextRow contains object key-value pairs of the fetched results.
     * The key value pairs contains <ColumnName>: <Result>
     * Since the <ColumnName> for this result is 'EXISTS (...)',
     * some trick is required to access the result.
     */
    const hasExistingAlert = Number.parseInt(Object.values(result[0])[0]) === 1
    const details = JSON.stringify({
      from: personDetails.from.toFormat(DATETIME_FORMAT),
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
    WHERE COALESCE(worker_updated_at, worker_created_at) = ?
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
        return null
      })
  })
}

Object.freeze(AlertGenerator)
module.exports = AlertGenerator
