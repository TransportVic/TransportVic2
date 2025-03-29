const utils = require('../../utils')

function convertToLive(trip, departureDay) {
  let startOfDay = utils.parseTime(departureDay).startOf('day')
  let operationDay = utils.getYYYYMMDD(startOfDay)
  
  trip.operationDays = operationDay

  return trip
}

module.exports = {
  convertToLive
}