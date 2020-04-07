const fs = require('fs')
const util = require('util')
const path = require('path')

const sharp = require('sharp')
const DateTime = require('luxon').DateTime

const logger = require('../config/logger').logger
const filesystem = require('../config/filesystem')
const unlink = util.promisify(fs.unlink)

function uploadLayoutFile (base64img, id) {
  const rawB64 = base64img.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
  const image = sharp(Buffer.from(rawB64, 'base64'))
    .metadata()
    .then(meta => {
      const ext = meta.format
      const now = DateTime.local()
      const filename = `zone_group-${id}-${now.toFormat('yyyyLLddHHMMss')}.${ext}`
      const filepath = path.join(filesystem.BASE_PATH, filesystem.UPLOAD_IMAGE_PATH, filename)

      return image.toFile(filepath)
        .then(info => {
          logger.info(`Created ZoneGroup layout file at ${filepath}. Size: ${info.size} bytes.`)
        })
        .then(() => path.join(filesystem.UPLOAD_IMAGE_PATH, filename))
    })
    .catch(err => {
      logger.error(`Caught error when saving file: ${err}`)
      throw err
    })

  return image
}

function removeExistingLayoutFile (filePath) {
  return unlink(path.join(filesystem.BASE_PATH, filePath))
    .then(() => {
      logger.info(`Successfully removed file at ${filePath}`)
    })
    .catch(err => {
      logger.error(`Caught error while removing file: ${err}`)
      throw err
    })
}

module.exports = { uploadLayoutFile, removeExistingLayoutFile }
