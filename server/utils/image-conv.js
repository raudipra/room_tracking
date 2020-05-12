const _ = require('lodash')
const Promise = require('bluebird')

function blobToJpegBase64 (blob) {
  // TODO check how to get proper image from Camvi
  return new Promise((resolve, reject) => {
    if (_.isNull(blob) || _.isUndefined(blob)) {
      reject(new TypeError('blob is null/undefined!'))
      return
    }

    resolve(`data:image/png;base64,${Buffer.from(blob).toString('base64')}`)
  }).timeout(5000)
}

module.exports = { blobToJpegBase64 }
