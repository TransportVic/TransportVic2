const utils = require('../../utils')
const { getTimeOffset } = require('../dst/dst')

function convertToLive(trip, departureDay) {
  let startOfDay = utils.parseTime(departureDay).startOf('day')
  let operationDay = utils.getYYYYMMDD(startOfDay)

  let hourOffset = getTimeOffset(startOfDay)
  trip.operationDays = operationDay

  for (let stop of trip.stopTimings) {
    if (stop.departureTimeMinutes) stop.departureTimeMinutes += hourOffset
    if (stop.arrivalTimeMinutes) stop.arrivalTimeMinutes += hourOffset

    let scheduledUTC = startOfDay.clone().add(stop.departureTimeMinutes || stop.arrivalTimeMinutes, 'minutes')
    stop.scheduledDepartureTime = scheduledUTC.toISOString()
  }

  return trip
}

module.exports = {
  convertToLive
}