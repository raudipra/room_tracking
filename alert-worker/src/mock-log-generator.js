const mysql = require('mysql2/promise')
const _ = require('lodash')
const Promise = require('bluebird')
const { DateTime } = require('luxon')
const faker = require('faker')
const logger = require('./utils/logger')('mock-log-generator')

require('dotenv').config()

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
  Promise: Promise
})

const sqlGetZonesAndCameras = `
  SELECT
    c.name AS camera_name,
    z.name AS zone_name
  FROM cameras c
  JOIN zones z ON c.zone_name = z.name
`

const sqlGetPeople = `
  SELECT id
  FROM persons
`

const sqlInsertFaceLog = `
  INSERT INTO face_logs
  (creation_time, camera_name, unknown_person_id, zone_name, person)
  VALUES (?, ?, ?, ?, ?)
`

const RETRY_INTERVAL = 3000
const INPUT_INTERVAL = 1000
function addNewFaceLog (camerasAndZones, people, maxTries = 5) {
  if (maxTries === 0) {
    throw new Error('addNewFaceLog has expired.')
  }

  logger.debug('Creating new row')
  const cameraZone = faker.random.arrayElement(camerasAndZones)
  const person = faker.random.arrayElement([...people, null])

  const isKnown = person !== null

  conn.then(con => con.query(sqlInsertFaceLog, [
    DateTime.fromJSDate(faker.date.recent(1)).toSQL({ includeOffset: false, includeZone: false }), // creation_time
    cameraZone.camera_name, // camera_name
    isKnown ? null : faker.random.number(), // unknown_person_id
    cameraZone.zone_name, // zone_name
    isKnown ? person : null, // person
  ]))
    .then(() => {
      logger.info(`New row created. Person: {id: ${person || 'null'}, is_known: ${isKnown}}`)
      setTimeout(() => {
        addNewFaceLog(camerasAndZones, people, maxTries)
      }, INPUT_INTERVAL)
      return null
    })
    .catch(err => {
      logger.error(err)
      setTimeout(() => {
        addNewFaceLog(camerasAndZones, people, maxTries - 1)
      }, RETRY_INTERVAL)
    })
}

function main () {
  return Promise.all([conn.then(con => con.query(sqlGetZonesAndCameras)), conn.then(con => con.query(sqlGetPeople))])
    .then(([resultZonesCameras, resultPeople]) => {
      const camerasAndZones = resultZonesCameras[0].map(row => ({
        camera_name: row.camera_name,
        zone_name: row.zone_name
      }))
      const people = resultPeople[0].map(row => row.id)
      return { camerasAndZones, people }
    })
    .then(({ camerasAndZones, people }) => {
      // loop this part every 1 second until
      // 1. exited
      // 2. failed maximum tries
      addNewFaceLog(camerasAndZones, people)
      return null
    })
    .catch(err => {
      logger.error(err)
    })
}

main()
