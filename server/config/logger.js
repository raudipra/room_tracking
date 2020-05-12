const winston = require('winston')
const expressWinston = require('express-winston')

const loggerTransports = []
if (process.env.NODE_ENV === 'debug') {
  loggerTransports.push(new winston.transports.Console({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
      winston.format.colorize(),
      winston.format.printf(info => {
        let out = `${info.timestamp} `
        if (info.metadata.module) {
          out += `[${info.metadata.module}]`
        }
        out += `(${info.level}) ${info.message}`
        return out
      })
    )
  }))
}
// NOTE: path is relative to the project's root directory.
loggerTransports.push(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }))
loggerTransports.push(new winston.transports.File({ filename: 'logs/combined.log' }))

const loggerMiddleware = expressWinston.logger({
  transports: loggerTransports,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json()
  )
})

const errorLoggerMiddleware = expressWinston.errorLogger({
  transports: loggerTransports,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json()
  )
})

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'debug' ? 'debug' : 'info',
  transports: loggerTransports,
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json()
  )
})

module.exports = { errorLoggerMiddleware, loggerMiddleware, logger }
