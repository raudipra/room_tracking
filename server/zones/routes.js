const express = require('express')
const multer = require('multer')
const _ = require('lodash')
const DateTime = require('luxon').DateTime

const dao = require('./dao')
const validator = require('./validator')
const utils = require('./utils')
const logger = require('../config/logger').logger
const { isTrue, isFalse } = require('../utils/bool')

const router = express.Router()
const upload = multer()

router.get('/', (req, res, next) => {
  if (_.has(req.query, 'name')) {
    const zoneQuery = req.query.name
    dao.getZones(zoneQuery)
      .then(result => {
        res.json(result)
      })
      .catch(next)
  } else if (_.has(req.query, 'all')) {
    dao.getZoneGroupsWithZone()
      .then(result => {
        res.json(result)
      })
      .catch(next)
  } else {
    dao.getZoneGroupsWithPeopleCount()
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
    // DEPRECATED. TODO remove
    hasUploadedFile = true
  }

  if (_.isUndefined(promise)) {
    promise = dao.createZone(postData)
      .then(result => {
        res.status(201).json(result)
      })
  }
  promise.catch(err => {
    // DEPRECATED. TODO remove
    if (hasUploadedFile) {
      // TODO remove uploaded file
    }
    next(err)
  })
})

router.post('/groups', upload.single('layout'), (req, res, next) => {
  // TODO check csrf

  // validate
  const zoneGroupData = req.body
  // try to parse as json
  const config = zoneGroupData.config
  try {
    zoneGroupData.config = JSON.parse(zoneGroupData.config)
  } catch (e) {
    // ignore the error, let the validator takeover.
    logger.warn(e)
    zoneGroupData.config = config
  }
  const errors = validator.validateZoneGroupData(zoneGroupData)

  const layoutFile = req.file
  if (!layoutFile) {
    errors.layout = 'Layout file is required!'
  }

  if (!_.isEmpty(errors)) {
    res.status(400).json({ errors })
    return
  }

  // process
  let uploadFilePath
  utils.uploadLayoutFile(layoutFile.buffer.toString('base64'))
    .then(newFilePath => {
      zoneGroupData.layout = newFilePath
      uploadFilePath = newFilePath

      // save to DB
      return dao.createZoneGroup(zoneGroupData)
    })
    .then(result => {
      res.json(result)
    })
    .catch(err => {
      if (uploadFilePath) {
        utils.removeExistingLayoutFile(uploadFilePath)
      }
      next(err)
    })
})

router.patch('/groups/:groupId', upload.single('layout'), (req, res, next) => {
  // TODO check csrf
  // validate
  const zoneGroupData = req.body
  const groupId = req.params.groupId
  // try to parse as json
  const config = zoneGroupData.config
  try {
    zoneGroupData.config = JSON.parse(zoneGroupData.config)
  } catch (e) {
    // ignore the error, let the validator takeover.
    logger.warn(e)
    zoneGroupData.config = config
  }
  const errors = validator.validateZoneGroupData(zoneGroupData)

  if (!_.isEmpty(errors)) {
    res.status(400).json({ errors })
    return
  }

  // process
  const layoutFile = req.file
  const hasLayoutFile = !!layoutFile
  let promise
  if (hasLayoutFile) {
    let uploadFilePath
    promise = utils.uploadLayoutFile(layoutFile.buffer.toString('base64'))
      .then(newFilePath => {
        uploadFilePath = newFilePath
        zoneGroupData.layout = newFilePath

        return dao.editZoneGroup(groupId, zoneGroupData)
      })
      .catch(err => {
        if (uploadFilePath) {
          utils.removeExistingLayoutFile(uploadFilePath)
            .catch(err => {
              logger.warn(`Failed to remove uploaded file: ${err}`)
            })
        }
        throw err
      })
  } else {
    promise = dao.editZoneGroup(groupId, zoneGroupData)
  }

  // process
  promise.then(result => {
    res.json(result)
  })
    .catch(next)
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

router.post('/alerts/:alertId', (req, res, next) => {
  // TODO check csrf
  const alertId = req.params.alertId || null
  if (_.isUndefined(alertId) || _.isNull(alertId)) {
    res.status(400).json({
      errors: {
        alertId: 'alertId param is required!'
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
  // TODO check csrf
  const postData = req.body
  const zoneId = req.params.zoneId

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

  // check existence
  dao.getZone(zoneId)
    .then(() => {
      let promise
      let hasUploadedFile = false
      if (_.isObjectLike(postData.zone_group)) {
        //  upload first
        hasUploadedFile = true
      }

      if (_.isUndefined(promise)) {
        promise = dao.editZone(zoneId, postData)
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
    .catch(err => {
      res.status(400).json({ errors: { zoneId: err.message } })
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

  let fromTs = req.query.ts_from || null
  let toTs = req.query.ts_to || null

  const orderBy = req.query.order_by || 'from'
  let descending = req.query.descending || 'false'
  let page = req.query.page || 1
  let limit = req.query.limit || 10

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

  // pagination validation
  const validOrderBy = ['from', 'person_id', 'is_known', 'to', 'person_name']
  if (!validOrderBy.includes(orderBy)) {
    errors.order_by = `unknown order parameter \`${orderBy}\`!`
  }
  if (!isTrue(descending) && !isFalse(descending)) {
    errors.descending = `unknown value \`${descending}\`!`
  } else {
    descending = isTrue(descending)
  }
  page = Number.parseInt(page)
  if (Number.isNaN(page) || page <= 0) {
    errors.page = 'invalid page!'
  }
  limit = Number.parseInt(limit)
  if (Number.isNaN(limit) || limit <= 0 || limit > 100) {
    errors.page = 'invalid limit!'
  }

  if (!_.isEmpty(errors)) {
    res.status(400).json({ errors })
    return
  }

  // execute
  if (date !== null) {
    dao.getPeopleInZoneByDate(zoneId, date, page, limit, orderBy, descending)
      .then(result => {
        res.json(result)
      })
      .catch(next)
  } else {
    fromTs = fromTs.replace('T', ' ')
    toTs = toTs.replace('T', ' ')
    dao.getPeopleInZoneByDateTimeRange(zoneId, fromTs, toTs, page, limit, orderBy, descending)
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
