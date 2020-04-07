class NotFoundError extends Error {
  constructor (className, id) {
    super(`Cannot find object \`${className}\` with id \`${id}\``)

    this.name = this.constructor.name
    this.className = className
    this.id = id
  }
}
module.exports = NotFoundError
