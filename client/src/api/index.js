import axios from 'axios'

const ALERT_TYPES = {
  UNKNOWN: 'U',
  UNAUTHORIZED: 'A',
  OVERSTAY: 'O'
}

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'

function getZones () {
  return axios.get(`${BASE_URL}/zones`)
    .then(response => response.data)
}

function getZonesByName (name) {
  return axios.get(`${BASE_URL}/zones?name=${name}`)
    .then(response => response.data)
}

function getPeopleCountHourlyInZone (zoneId, date) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/hourly-count?date=${date}`)
    .then(response => response.data)
}

function getPeopleWihtinDateTimeRange (zoneId, dateTimeFrom, dateTimeTo) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/people-within?ts_from=${dateTimeFrom}&ts_to=${dateTimeTo}`)
    .then(response => response.data)
}

function getPeopleWihtinDate (zoneId, date) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/people-within?date=${date}`)
    .then(response => response.data)
}

function getPeopleForZone (zoneId) {
  return axios.get(`${BASE_URL}/zones/${zoneId}/people`)
    .then(response => response.data)
}

function getAlertsForZone (zoneId, isDismissed = false) {
  return axios.get(`${BASE_URL}/zones/alerts?zone_ids=${zoneId}`)
    .then(response => response.data)
}

function dismissAlert (alertId) {
  return axios.post(`${BASE_URL}/zones/alerts/${alertId}`, { is_dismissed: true })
    .then(response => response.data)
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
