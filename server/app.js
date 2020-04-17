const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const cors = require('cors')
require('dotenv').config()

const logger = require('./config/logger')

const zoneRouter = require('./zones/routes')

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cors())
app.use(cookieParser())
app.use('/public', express.static(path.join(__dirname, 'public')))

// apply regular log BEFORE routers are applied
app.use(logger.loggerMiddleware)

// apply routes
app.use('/zones', zoneRouter)
app.use('/', (req, res) => {
  res.status(400)
})

// apply error logs AFTER routers are applied
app.use(logger.errorLoggerMiddleware)

// error handlers are last
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  res.status(500)
  res.json({ errors: { message: err.message } })
  next(err)
})

module.exports = app
