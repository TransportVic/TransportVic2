const utils = require('../../utils')
const { getDepartures } = require('../departures/get-departures')

async function getMetroDepartures(station, db, filter, backwards, departureTime) {
  let departures = await getDepartures(station, 'metro train', db, { departureTime })

  return departures.map(departure => {
    let { trip, currentStop } = departure

    let par = trip.stopTimings.find(stop => stop.stopName === 'Parliament Railway Station')
    let hasALT = trip.stopTimings.some(stop => stop.stopName === 'Altona Railway Station')

    return {
      ...departure,
      fleetNumber: null,
      runID: trip.runID,
      platform: currentStop.platform,
      destination: departure.destination.slice(0, -16),
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