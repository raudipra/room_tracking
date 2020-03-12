const mysql = require('mysql2')

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'mysql',
  waitForConnections: true,
  connectionLimit: process.env.connectionLimit || 10,
  queueLimit: 0
})

module.exports = pool
