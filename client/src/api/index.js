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
    .then(response => response.data.map(r => Object.assign(r, {
      from: new Date(r.from),
      to: r.to ? new Date(r.to) : null
    })))
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

function createZone (zone) {
  // reconstruct
  const data = {
    id: zone.id,
    name: zone.name,
    description: zone.description,
    config: {
      is_active: zone.is_active,
      overstay_limit: zone.overstay_limit
    },
    zone_group: zone.zone_group_id
  }

  return axios.post(`${BASE_URL}/zones`, data)
    .then(response => response.data)
    .then(data => {
      data.zone_group_id = data.zone_group.id
      delete data.zone_group
      return data
    })
}

function editZone (id, zone) {
  // reconstruct
  const data = {
    id: zone.id,
    name: zone.name,
    description: zone.description,
    config: {
      is_active: zone.is_active,
      overstay_limit: zone.overstay_limit
    },
    zone_group: zone.zone_group_id
  }

  return axios.patch(`${BASE_URL}/zones/${id}`, data)
    .then(response => response.data)
    .then(data => {
      data.zone_group_id = data.zone_group.id
      delete data.zone_group
      return data
    })
}

function createZoneGroup (zoneGroup) {
  return axios.post(`${BASE_URL}/zones/groups`, zoneGroup, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
    .then(response => response.data)
}

function editZoneGroup (id, zoneGroup) {
  return axios.patch(`${BASE_URL}/zones/groups/${id}`, zoneGroup, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
    .then(response => response.data)
}

function getAllZones () {
  return axios.get(`${BASE_URL}/zones/?all=true`)
    .then(response => response.data)
}

function handleApiError (err) {
  if (err.response) {
    return err.response.data
  } else if (err.request) {
    return 'Error while processing request!'
  } else {
    return err.message ? err.message : 'UNKNOWN'
  }
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
  getAllZones,
  getZonesByName,
  getPeopleForZone,
  getAlertsForZone,
  dismissAlert,
  getPeopleWihtinDateTimeRange,
  getPeopleWihtinDate,
  getPeopleCountHourlyInZone,
  createZone,
  editZone,
  createZoneGroup,
  editZoneGroup,
  handleApiError,
  BASE_URL
}
