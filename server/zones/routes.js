const express = require('express')
const _ = require('lodash')
const DateTime = require('luxon').DateTime

const dao = require('./dao')
const validator = require('./validator')

const router = express.Router()

router.get('/', (req, res, next) => {
  if (_.has(req.query, 'name')) {
    const zoneQuery = req.query.name
    dao.getZones(zoneQuery)
      .then(result => {
        res.json(result)
      })
  } else {
    dao.getZoneGroups()
      .then(result => {
        res.json(result)
      })
      .catch(next)
  }
})

router.post('/', (req, res, next) => {
  // TODO check csrf
  const postData = req.body

  if (!_.isObjectLike(postData)) {
    res.status(400).json({
      errors: {
        _body: 'This method only accepts JSON.'
      }
    })
    return
  }

  // validate
  const errors = validator.validateZoneData(postData)
  if (!_.isEmpty(errors)) {
    res.status(400).json({ errors })
    return
  }

  let promise
  let hasUploadedFile = false
  if (_.isObjectLike(postData.zone_group)) {
    //  upload first
    hasUploadedFile = true
  }

  if (_.isUndefined(promise)) {
    promise = dao.createZone(postData)
      .then(result => {
        res.status(201).json(result)
      })
  }
  promise.catch(err => {
    if (hasUploadedFile) {
      // TODO remove uploaded file
    }
    next(err)
  })
})

router.post('/groups', (req, res, next) => {
  // TODO check csrf
  // TODO implement edit zone group
  res.status(501).json({
    errors: { message: 'Not implemented' }
  })
})

router.patch('/groups/:groupId', (req, res, next) => {
  // TODO check csrf
  // TODO implement edit zone
  res.status(501).json({
    errors: { message: 'Not implemented' }
  })
})

router.get('/alerts', (req, res, next) => {
  if (!_.has(req.query, 'zone_ids')) {
    res.status(400).json({
      errors: {
        zone_ids: '`zone_ids` must be defined!'
      }
    })
    return
  }

  const zoneIds = req.query.zone_ids.split(',')
  dao.getAlerts(zoneIds)
    .then(result => {
      res.json(result)
    })
    .catch(next)
})

router.patch('/alerts/:alertId', (req, res, next) => {
  // TODO check csrf
  const alertId = req.params.alertId || null
  if (_.isUndefined(alertId) || _.isNull(alertId)) {
    res.status(400).json({
      errors: {
        alertId: 'aletId param is required!'
      }
    })
    return
  }

  dao.dismissAlert(alertId)
    .then(result => {
      res.json(result)
    })
    .catch(next)
})

router.get('/persons', (req, res, next) => {
  if (!_.has(req.query, 'zone_ids')) {
    res.status(400).json({
      errors: {
        zone_ids: '`zone_ids` must be defined!'
      }
    })
    return
  }

  const zoneIds = req.query.zone_ids.split(',')
  dao.getPeopleInZones(zoneIds)
    .then(result => {
      res.json(result)
    })
    .catch(next)
})

router.patch('/:zoneId', (req, res, next) => {
  // TODO implement edit zone
  res.status(501).json({
    errors: { message: 'Not implemented' }
  })
})

router.get('/:zoneId/people', (req, res, next) => {
  const zoneId = req.params.zoneId
  dao.getPeopleInZones([zoneId])
    .then(result => {
      res.json(result)
    })
    .catch(next)
})

router.get('/:zoneId/people-within', (req, res, next) => {
  const zoneId = req.params.zoneId || null
  const date = req.query.date || null

  const fromTs = req.query.ts_from || null
  const toTs = req.query.ts_to || null

  // do validation
  const errors = {}
  if (_.isNull(zoneId)) {
    errors.zone_id = 'zone_id is empty!'
  }

  if (date === null && fromTs === null) {
    errors.date = '`date` is not defined! You need to define either `date` or (`ts_from` and `ts_to`) pair.'
    errors.ts_from = '`ts_from` is not defined! You need to define either `date` or (`ts_from` and `ts_to`) pair.'
  }

  if (date !== null) {
    const dateCheck = DateTime.fromFormat(date, 'yyyy-LL-dd')
    if (!dateCheck.isValid) {
      errors.date = '`date` is not in valid format!'
    }
  }

  if (fromTs !== null && toTs === null) {
    errors.ts_to = '`ts_to` is empty! You need to define either `date` or (`ts_from` and `ts_to`) pair.'
  }

  if (!_.isEmpty(errors)) {
    res.status(400).json({ errors })
    return
  }

  // execute
  if (date !== null) {
    dao.getPeopleInZoneByDate(zoneId, date)
      .then(result => {
        res.json(result)
      })
      .catch(next)
  } else {
    dao.getPeopleInZoneByDateTimeRange(zoneId, fromTs, toTs)
      .then(result => {
        res.json(result)
      })
      .catch(next)
  }
})

router.get('/:zoneId/hourly-count', (req, res, next) => {
  const zoneId = req.params.zoneId || null
  const date = req.query.date || null

  // do validation
  const errors = {}
  if (_.isNull(zoneId)) {
    errors.zone_id = 'zone_id is empty!'
  }

  if (date === null) {
    errors.date = 'date is not defined!'
  }
  if (date !== null) {
    const dateCheck = DateTime.fromFormat(date, 'yyyy-LL-dd')
    if (!dateCheck.isValid) {
      errors.date = '`date` is not in valid format!'
    }
  }

  dao.getPeopleCountHourlyInZone(zoneId, date)
    .then(result => {
      res.json(result)
    })
    .catch(next)
})

module.exports = router
