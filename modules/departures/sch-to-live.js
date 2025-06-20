const utils = require('../../utils')
const { getTimeOffset } = require('../dst/dst')

function convertToLive(trip, departureDay) {
  let startOfDay = utils.parseTime(departureDay).startOf('day')
  let operationDay = utils.getYYYYMMDD(startOfDay)

  let hourOffset = getTimeOffset(startOfDay)
  trip.operationDays = operationDay

  for (let stop of trip.stopTimings) {
    let scheduledUTC

    if (stop.arrivalTimeMinutes) {
      stop.arrivalTimeMinutes += hourOffset
      let scheduledArrUTC = startOfDay.clone().add(stop.arrivalTimeMinutes, 'minutes')
      stop.arrivalTime = scheduledArrUTC.format('HH:mm')

      scheduledUTC = scheduledArrUTC
    }

    if (stop.departureTimeMinutes) {
      stop.departureTimeMinutes += hourOffset
      let scheduledDepUTC = startOfDay.clone().add(stop.departureTimeMinutes, 'minutes')
      stop.departureTime = scheduledDepUTC.format('HH:mm')

      scheduledUTC = scheduledDepUTC
    }

    stop.scheduledDepartureTime = scheduledUTC.toISOString()
    stop.actualDepartureTimeMS = +scheduledUTC
    stop.estimatedDepartureTime = null
    stop.cancelled = false
  }

  return trip
}

module.exports = {
  convertToLive
}