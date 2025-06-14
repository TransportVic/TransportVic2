const utils = require('../../utils')
const { getDepartures } = require('../departures/get-departures')

async function getMetroDepartures(station, db, filter, backwards, departureTime) {
  let departures = await getDepartures(station, 'metro train', db, { departureTime })

  return departures.map(departure => {
    let { trip, currentStop } = departure

    let par = trip.stopTimings.find(stop => stop.stopName === 'Parliament Railway Station')
    let hasALT = trip.stopTimings.some(stop => stop.stopName === 'Altona Railway Station')

    let origin = trip.stopTimings.find(stop => !stop.cancelled).stopName
    let destination = trip.stopTimings.findLast(stop => !stop.cancelled).stopName

    let trueOrigin = trip.stopTimings.find(stop => !stop.additional).stopName
    let trueDestination = trip.stopTimings.findLast(stop => !stop.additional).stopName

    if (currentStop.cancelled && !trip.cancelled) {
      origin = trueOrigin
      destination = trueDestination
    }

    return {
      ...departure,
      fleetNumber: trip.vehicle ? trip.vehicle.consist : null,
      vehicle: trip.vehicle,
      runID: trip.runID,
      platform: currentStop.platform,
      origin: origin.slice(0, -16),
      destination: destination.slice(0, -16),
      trueOrigin: trueOrigin.slice(0, -16),
      trueDestination: trueDestination.slice(0, -16),
      direction: trip.direction,
      viaCityLoop: !!par,
      isSkippingLoop: par ? par.cancelled : null,
      viaAltonaLoop: trip.routeName === 'Werribee' ? hasALT : null,
      isRailReplacementBus: trip.isRailReplacementBus,
      departureDay: trip.operationDays,
      allStops: departure.allStops.map(stop => stop.slice(0, -16)),
      futureStops: departure.futureStops.map(stop => stop.slice(0, -16)),
      cityLoopRunning: []
    }
  })
}

module.exports = getMetroDepartures