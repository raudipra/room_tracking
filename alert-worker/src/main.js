const { Settings } = require('luxon')

// load/set config
require('dotenv').config()
Settings.defaultZoneName = process.env.TIMEZONE || 'Asia/Jakarta'

const logger = require('./utils/logger')('main')

const AlertGenerator = require('./alert-generator')
const LocationUpdater = require('./location-update')

LocationUpdater.run()
const LOCATION_UPDATE_PERIOD_MS = 5 * 1000
setInterval(() => {
  if (LocationUpdater.isRunning()) {
    return
  }

  LocationUpdater.run()
}, LOCATION_UPDATE_PERIOD_MS)

AlertGenerator.run()
const ALERT_GENERATOR_INTERVAL_MS = 3 * 1000
setInterval(() => {
  if (AlertGenerator.isRunning()) {
    return
  }

  logger.debug('Starting alert generator...')
  AlertGenerator.run()
}, ALERT_GENERATOR_INTERVAL_MS)
