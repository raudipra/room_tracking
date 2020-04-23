import * as DateTimeFormat from '../date-time'

function formatDateTime (val) {
  if (!val) return ''
  if (val instanceof Date) {
    return val.toLocaleString(DateTimeFormat.DATE_TIME_FORMAT)
  }
  try {
    return (new Date(val)).toLocaleString(DateTimeFormat.DATE_TIME_FORMAT)
  } catch (e) {
    return 'Invalid Date'
  }
}

function formatDate (val) {
  if (!val) return ''
  if (val instanceof Date) {
    return val.toDateString(DateTimeFormat.DATE_FORMAT)
  }
  // try to parse
  try {
    return (new Date(val)).toDateString(DateTimeFormat.DATE_FORMAT)
  } catch (e) {
    return 'Invalid Date'
  }
}

function formatTime (val) {
  if (!val) return ''
  if (val instanceof Date) {
    return val.toTimeString(DateTimeFormat.TIME_FORMAT)
  }
  try {
    return (new Date(val)).toTimeString(DateTimeFormat.TIME_FORMAT)
  } catch (e) {
    return 'Invalid Time'
  }
}

function formatHour (val) {
  if (val instanceof Number) {
    if (val < 0) {
      return 'Invalid Hour'
    }
    return val < 10 ? `0${val}:00` : `${val}:00`
  }
  return 'Invalid Hour'
}

export default {
  filters: { formatDate, formatDateTime, formatTime, formatHour }
}
