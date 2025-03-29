const moment = require('moment-timezone')
moment.tz.setDefault('Australia/Melbourne')

module.exports = function isDSTChange(date) {
  let givenDay = moment(date)
  let previousDay = givenDay.clone().add(-1, 'day')

  let previousUTCOffset = previousDay.utcOffset()
  let givenUTCOffset = givenDay.utcOffset()

  return previousUTCOffset !== givenUTCOffset
}