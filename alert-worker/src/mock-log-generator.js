const mysql = require('mysql2/promise')
const _ = require('lodash')
const Promise = require('bluebird')
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
    c.camera_name,
    z.zone_name
  FROM cameras c
  JOIN zones z ON c.zone_name = z.zone_name
`

const sqlGetPeople = `
  SELECT id
  FROM persons
`

const sqlInsertFaceLog = `
  INSERT INTO face_logs
  (creation_time, age, calibratedScore, camera_name, data, gender, image, out_time, score, unknown_person_id, zone_name, person)
  VALUES (:creation_time, NULL, NULL, :camera_name, NULL, NULL, NULL, NULL, :score, :unknown_person_id, :zone_name, :person)
`
