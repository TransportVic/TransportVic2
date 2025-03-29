const utils = require('../../utils')

function convertToLive(trip, departureDay) {
  let startOfDay = utils.parseTime(departureDay).startOf('day')
  let operationDay = utils.getYYYYMMDD(startOfDay)
  
  trip.operationDays = operationDay

  for (let stop of trip.stopTimings) {
    let scheduledUTC = startOfDay.clone().add(stop.departureTimeMinutes || stop.arrivalTimeMinutes, 'minutes')
    stop.scheduledDepartureTime = scheduledUTC.toISOString()
  }

  return trip
}

module.exports = {
  convertToLive
}