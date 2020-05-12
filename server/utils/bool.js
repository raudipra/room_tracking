function isTrue (val) {
  return [true, 1, '1', 'true', 'yes'].includes(val)
}

function isFalse (val) {
  return [false, 0, '0', 'false', 'no'].includes(val)
}

module.exports = { isTrue, isFalse }
