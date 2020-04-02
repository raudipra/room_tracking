import axios from 'axios'

const ALERT_TYPES = {
  UNKNOWN: 'U',
  UNAUTHORIZED: 'A',
  OVERSTAY: 'O'
}

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

function getZones () {
  return axios.get(`${BASE_URL}/zones`)
}

function getZonesByName (name) {
  return axios.get(`${BASE_URL}/zones?name=${name}`)
}

function getPeopleCountHourlyInZone (zoneId, date) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/hourly-count?date=${date}`)
}

function getPeopleWihtinDateTimeRange (zoneId, dateTimeFrom, dateTimeTo) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/people-within?ts_from=${dateTimeFrom}&ts_to=${dateTimeTo}`)
}

function getPeopleWihtinDate (zoneId, date) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/people-within?date=${date}`)
}

function getPeopleForZone (zoneId) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/people`)
}

function getAlertsForZone (zoneId, isDismissed = false) {
  // TODO stub
  return axios.get(`${BASE_URL}/zones/alerts?zone_ids=${zoneId}`)
}

function dismissAlert (alertId) {
  return axios.post(`${BASE_URL}/zones/alerts/${alertId}`, { is_dismissed: true })
}

function getAlertLabel (alert) {
  switch (alert) {
    case ALERT_TYPES.UNKNOWN:
      return 'Unknown person'
    case ALERT_TYPES.UNAUTHORIZED:
      return 'Unauthorized'
    case ALERT_TYPES.OVERSTAY:
      return 'Overstay'
    default:
      return 'UNKNOWN ALERT'
  }
}

export { ALERT_TYPES, getAlertLabel }
export default {
  getZones,
  getZonesByName,
  getPeopleForZone,
  getAlertsForZone,
  dismissAlert,
  getPeopleWihtinDateTimeRange,
  getPeopleWihtinDate,
  getPeopleCountHourlyInZone
}
