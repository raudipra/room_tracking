const _ = require('lodash')
const Promise = require('bluebird')

function blobToJpegBase64 (blob) {
  return new Promise((resolve, reject) => {
    if (_.isNull(blob) || _.isUndefined(blob)) {
      reject(new TypeError('blob is null/undefined!'))
      return
    }

    // TODO check how to get proper image from Camvi
    resolve(null)
  }).timeout(5000)
}

module.exports = { blobToJpegBase64 }
