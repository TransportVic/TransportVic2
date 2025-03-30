const utils = require('../../utils')
const { getDepartures } = require('../departures/get-departures')

async function getMetroDepartures(station, db, filter, backwards, departureTime) {
  let departures = await getDepartures(station, 'metro train', db, { departureTime })

  return departures.map(trip => {
    // Pick the first time it appears - for MTM the second time will only be for FSS and it will be drop off only
    let currentStopIndex = trip.stopTimings.findIndex(stop => stop.stopName === station.stopName)
    let currentStop = trip.stopTimings[currentStopIndex]
    let par = trip.stopTimings.find(stop => stop.stopName === 'Parliament Railway Station')
    let hasALT = trip.stopTimings.some(stop => stop.stopName === 'Altona Railway Station')

    let scheduledDepartureTime = utils.parseTime(currentStop.scheduledDepartureTime)
    let estimatedDepartureTime = currentStop.estimatedDepartureTime ? utils.parseTime(currentStop.estimatedDepartureTime) : null

    return {
      scheduledDepartureTime,
      estimatedDepartureTime,
      actualDepartureTime: estimatedDepartureTime || scheduledDepartureTime,
      fleetNumber: null,
      runID: trip.runID,
      platform: currentStop.platform,
      cancelled: trip.cancelled || currentStop.cancelled,
      routeName: trip.routeName,
      codedRouteName: utils.encodeName(trip.routeName),
      trip,
      destination: trip.destination.slice(0, -16),
      direction: trip.direction,
      viaCityLoop: !!par,
      isSkippingLoop: par ? par.cancelled : null,
      viaAltonaLoop: trip.routeName === 'Werribee' ? hasALT : null,
      isRailReplacementBus: trip.isRailReplacementBus,
      departureDay: trip.operationDays,
      allStops: trip.stopTimings.map(stop => stop.stopName.slice(0, -16)),
      futureStops: trip.stopTimings.slice(currentStopIndex + 1).map(stop => stop.stopName.slice(0, -16)),
      cityLoopRunning: []
    }
  })
}

module.exports = getMetroDepartures