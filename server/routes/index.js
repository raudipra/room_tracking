const express = require('express')
const router = express.Router()

const db = require('../db')

router.get('/zones', (req, res) => {
  db.getZoneGroups()
    .then(result => {
      res.json(result)
    })
})

router.get('/alerts', (req, res) => {
  const zoneIds = req.query.zoneIds.split(',')
  db.getAlerts(zoneIds)
    .then(result => {
      res.json(result)
    })
})

router.get('/zones/persons', (req, res) => {
  const zoneIds = req.query.zoneIds.split(',')
  db.getPeopleInZones(zoneIds)
    .then(result => {
      res.json(result)
    })
})

router.get('/zones/:zoneId/people', (req, res) => {
  const zoneId = req.param('zoneId')
  db.getAlerts([zoneId])
    .then(result => {
      res.json(Object.values(result)[0].alerts)
    })
})

router.get('/zones/:zoneId/people-within', (req, res) => {
  const zoneId = req.param('zoneId')
  const date = req.param('date')
  const fromHour = req.param('hour_from')
  const toHour = req.param('hour_to')

  db.getPeopleInZoneWithin(zoneId, date, fromHour, toHour)
    .then(result => {
      res.json(result)
    })
})

module.exports = router
