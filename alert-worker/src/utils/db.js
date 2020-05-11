const mysql = require('mysql2/promise')
const Promise = require('bluebird')
const _ = require('lodash')

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 3,
  Promise: Promise
})

// this is used by the alert generator to check backoff.
const backoffPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  Promise: Promise
})

function getConnection () {
  return pool.getConnection().disposer(conn => {
    conn.release()
  })
}

function getBackoffConnection () {
  return backoffPool.getConnection().disposer(conn => {
    conn.release()
  })
}

function withTransaction (fn) {
  return Promise.using(getConnection(), conn => {
    const tx = conn.beginTransaction()
    return tx.then(() => fn.apply(null, [conn]))
      .then(
        res => {
          return conn.commit().thenReturn(res)
        },
        err => conn.rollback()
          .catch(e => {
            const stack = `
In addition, the following error were caught when trying to rollback the transaction:
${e.stack.split('\n').slice(0,2).join('\n')}
              `
            if (err instanceof Error) {
              err.stack += stack
            } else if (err instanceof String) {
              err += stack
            }
          })
          .thenThrow(err))
  })
}

// converts a non-object array to its respective values
function arrayToUnion (arr, label) {
  if (_.isEmpty(arr)) {
    console.warn('array is empty!')
    return ''
  }

  let result = ''
  result += mysql.format(`SELECT ? as '${label}'`, [arr[0]])
  for (let i = 1; i < arr.length; i++) {
    result += mysql.format(' UNION ALL SELECT ?', [arr[i]])
  }
  return result
}

module.exports = { getConnection, getBackoffConnection, withTransaction, arrayToUnion, pool }
