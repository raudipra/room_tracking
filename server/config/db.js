const mysql = require('mysql2/promise')
const bluebird = require('bluebird')

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 2,
  Promise: bluebird
})

function blobToJpegBase64 (blob) {
  return 'data:image/jpeg;charset=utf-8;base64,' + Buffer.from(blob).toString('base64')
}

function getConnection () {
  return pool.getConnection().disposer(conn => {
    conn.release()
  })
}

module.exports = { getConnection, blobToJpegBase64 }
