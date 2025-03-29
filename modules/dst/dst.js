const moment = require('moment-timezone')
moment.tz.setDefault('Australia/Melbourne')

function isDSTChange(date) {
  return getTimeOffset(date) !== 0
}

function getTimeOffset(date) {
  let givenDay = moment(date)
  let previousDay = givenDay.clone().add(-1, 'day')

  let previousUTCOffset = previousDay.utcOffset()
  let givenUTCOffset = givenDay.utcOffset()

  return previousUTCOffset - givenUTCOffset
}

module.exports = {
  isDSTChange,
  getTimeOffset
}