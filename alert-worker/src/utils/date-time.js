const _ = require('lodash')
const { DateTime } = require('luxon')
const DEFAULT_SQL_DATETIME_FORMAT = 'yyyy-LL-dd HH:mm:ss'

/**
 * Converts a JS {@link Date} to SQL DateTime string
 * @param {?Date} dateTime
 * @param {string} format - format of the SQL date.
 * @returns {?string} SQL-formatted DateTime
 */
function formatDateTime (dateTime, format = DEFAULT_SQL_DATETIME_FORMAT) {
  if (_.isUndefined(dateTime) || _.isNull(dateTime)) return null

  return DateTime.fromJSDate(dateTime).toFormat(format)
}

module.exports = {
  DEFAULT_SQL_DATETIME_FORMAT, formatDateTime
}
