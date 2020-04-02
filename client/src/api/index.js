import faker from 'faker'
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

function getPeopleForZone (zoneId) {
  // TODO stub
  console.debug(`Getting current people in ${BASE_URL + zoneId}`)
  return new Promise(resolve => {
    setTimeout(() => {
      const mockData = []
      for (let i = 0; i < 10; i++) {
        mockData.push({
          id: faker.random.uuid(),
          name: faker.name.findName(),
          from: faker.date.between(faker.date.recent(), new Date()),
          picture: faker.image.avatar(),
          alerts: []
        })
      }
      resolve(mockData)
    }, 1000)
  })
}

function getAlertsForZone (zoneId) {
  // TODO stub
  console.debug(`Getting current alerts in ${zoneId}`)
  return new Promise(resolve => {
    setTimeout(() => {
      const alertTypes = Object.values(ALERT_TYPES)
      const mockData = []
      for (let i = 0; i < 10; i++) {
        mockData.push({
          id: faker.random.uuid(),
          type: faker.random.arrayElement(alertTypes),
          created_at: faker.date.recent,
          is_known: faker.random.boolean(),
          person: {
            id: faker.random.uuid(),
            name: faker.name.findName(),
            from: faker.date.between(faker.date.recent(), new Date()),
            picture: faker.image.avatar()
          }
        })
      }
      resolve(mockData)
    }, 1000)
  })
}

function dismissAlert (alertId) {
  // TODO stub
  console.debug(`Dismissing alert ${alertId}`)
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(true)
    }, 1000)
  })
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
  getZones, getPeopleForZone, getAlertsForZone, dismissAlert
}
