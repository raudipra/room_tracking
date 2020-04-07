const _ = require('lodash')

const HOUR_MINUTES_REGEX = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/

function validateZoneData (data) {
  const errors = {}

  if (!_.has(data, 'name')) {
    errors.name = 'Name must not be empty!'
  } else if (data.name.toString().trim() === '') {
    errors.name = 'Name must not be blank!'
  }

  if (_.has(data, 'description')) {
    if (data.description.toString().length > 255) {
      errors.description = 'Description is too long! Max length is 255 chars.'
    }
  }

  if (!_.has(data, 'config')) {
    errors.config = 'config is required!'
  } else if (!_.isObjectLike(data, 'config')) {
    errors.config = 'config is invalid!'
  } else {
    const config = data.config

    // validate the config
    const configErrors = {}
    if (!_.has(config, 'overstay_limit')) {
      configErrors.overstay_limit = 'overstay_limit is required!'
    } else {
      const overstayLimit = config.overstay_limit
      if (!overstayLimit.toString().matches(HOUR_MINUTES_REGEX)) {
        configErrors.overstay_limit = 'overstay_limit is invalid! it should be in HH:MM format'
      }
    }

    if (!_.has(config, 'is_active')) {
      configErrors.is_active = 'is_active is required!'
    } else {
      const isActive = config.isActive
      if (!_.isBoolean(isActive)) {
        configErrors.is_active = 'is_active is invalid! it should be either `true` or `false`.'
      }
    }

    if (!_.isEmpty(configErrors)) {
      errors.config = configErrors
    }
  }

  if (!_.has(data, 'zone_group')) {
    let zoneGroupErrors
    if (_.isObjectLike(data.zone_group)) {
      zoneGroupErrors = validateZoneGroupData(data.zone_group)
    } else if (!_.isString(data.zone_group) && !_.isNumber(data.zone_group)) {
      zoneGroupErrors = 'zone_group is invalid!'
    }

    if (!_.isEmpty(zoneGroupErrors)) {
      errors.zone_group = zoneGroupErrors
    }
  }

  return errors
}

function validateZoneGroupData (data) {
  const errors = {}

  if (!_.has(data, 'name')) {
    errors.name = 'Name must not be empty!'
  } else if (data.name.toString().trim() === '') {
    errors.name = 'Name must not be blank!'
  }

  // description is mandatory.
  if (_.has(data, 'description')) {
    if (data.description.toString().length > 255) {
      errors.description = 'Description is too long! Max length is 255 chars.'
    }
  }

  // layout_src should be either nonexistent/null, or contain base64 image
  if (_.has(data, 'layout_src')) {
    const layoutSrc = data.layout_src
    if (!_.isNull(layoutSrc) && !_.isUndefined(layoutSrc)) {
      // TODO
    }
  }

  if (!_.has(data, 'config')) {
    errors.config = 'config is required!'
  } else if (!_.isObjectLike(data, 'config')) {
    errors.config = 'config is invalid!'
  } else {
    const config = data.config
    const configErrors = {}
    // validate the config
    if (!_.has(config, 'default_overstay_limit')) {
      configErrors.default_overstay_limit = 'default_overstay_limit is required!'
    } else {
      const defaultOverstayLimit = config.default_overstay_limit
      if (!defaultOverstayLimit.toString().matches(HOUR_MINUTES_REGEX)) {
        configErrors.default_overstay_limit = 'default_overstay_limit is invalid! it should be in HH:MM format'
      }
    }

    if (!_.isEmpty(configErrors)) {
      errors.config = configErrors
    }
  }

  return errors
}

module.exports = { validateZoneData, validateZoneGroupData }
