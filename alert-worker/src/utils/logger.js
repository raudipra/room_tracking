const winston = require('winston')
const path = require('path')

const WORKER_ID = process.env.WORKER_ID || 'worker'
const LOG_PATH = path.resolve(__dirname, '../../', 'logs/')

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  defaultMeta: { worker: WORKER_ID },
  transports: [
    new winston.transports.File({ filename: path.join(LOG_PATH, 'worker.log') })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
      winston.format.colorize(),
      winston.format.printf(info => {
        let out = `${info.timestamp} `
        if (info.metadata.module) {
          out += `[${info.metadata.module}]`
        } else {
          out += `[Unknown Module]`
        }
        out += `(${info.level}) ${info.message}`
        return out
      })
    )
  }))
}

module.exports = moduleName => logger.child({
  module: moduleName
})
