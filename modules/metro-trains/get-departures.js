const { getDepartures } = require('../departures/get-departures')

const CITY_LOOP = [
  'Parliament',
  'Melbourne Central',
  'Flagstaff',
  'Southern Cross'
]

async function getMetroDepartures(station, db, filter, backwards, departureTime) {
  let departures = await getDepartures(station, 'metro train', db, { departureTime })
  let liveTimetables = db.getCollection('live timetables')

  let isWithinCityLoop = CITY_LOOP.includes(station.stopName.slice(0, -16))

  let outputDepartures = []
  for (let departure of departures) {
    let { trip, currentStop } = departure

    let par = trip.stopTimings.find(stop => stop.stopName === 'Parliament Railway Station')
    let hasALT = trip.stopTimings.some(stop => stop.stopName === 'Altona Railway Station')

    let origin, trueOrigin, destination, trueDestination

    trueOrigin = trip.stopTimings.find(stop => !stop.additional).stopName.slice(0, -16)
    trueDestination = trip.stopTimings.findLast(stop => !stop.additional).stopName.slice(0, -16)
    if (!isWithinCityLoop && trueDestination === 'Flinders Street' && trip.direction === 'Up' && !!par) trueDestination = 'City Loop'

    let updatedOrigin = trip.stopTimings.find(stop => !stop.cancelled).stopName.slice(0, -16)
    let destinationStop = trip.stopTimings.findLast(stop => !stop.cancelled)
    let updatedDestination = destinationStop.stopName.slice(0, -16)

    if (!isWithinCityLoop && updatedDestination === 'Flinders Street' && trip.direction === 'Up' && !!par && !par.cancelled) updatedDestination = 'City Loop'
    if (destinationStop === currentStop) departure.cancelled = (currentStop.cancelled = true) // Rest of the trip is cancelled so this stop is also cancelled

    // If current stop is cancelled but the trip is still running, show the original details
    if (currentStop.cancelled && !trip.cancelled) {
      updatedOrigin = trueOrigin
      updatedDestination = trueDestination
    }

    if (updatedOrigin !== trueOrigin) origin = updatedOrigin
    else origin = trueOrigin

    if (updatedDestination !== trueDestination) destination = updatedDestination
    else destination = trueDestination

    let futureStops = departure.futureStops.map(stop => stop.slice(0, -16))
    let formingDestination = null, formingRunID = null, futureFormingStops = null
    let formingTrip

    let shouldShowForming = isWithinCityLoop && trip.direction === 'Up'
  
    if (shouldShowForming) {
      formingTrip = trip.forming ? await liveTimetables.findDocument({
        mode: 'metro train',
        operationDays: trip.operationDays,
        runID: trip.forming
      }) : null
    
      if (formingTrip) {
        formingDestination = formingTrip.destination.slice(0, -16)
        formingRunID = formingTrip.runID
        futureFormingStops = futureStops.concat(
          formingTrip.stopTimings.slice(1).map(stop => stop.stopName.slice(0, -16))
        )
      }
    }

    outputDepartures.push({
      ...departure,
      fleetNumber: trip.vehicle ? trip.vehicle.consist : null,
      vehicle: trip.vehicle,
      runID: trip.runID,
      platform: currentStop.platform,
      origin: origin,
      destination: destination,
      trueOrigin: trueOrigin,
      trueDestination: trueDestination,
      direction: trip.direction,
      viaCityLoop: !!par,
      isSkippingLoop: par ? par.cancelled : null,
      viaAltonaLoop: trip.routeName === 'Werribee' ? hasALT : null,
      isRailReplacementBus: trip.isRailReplacementBus,
      departureDay: trip.operationDays,
      allStops: departure.allStops.map(stop => stop.slice(0, -16)),
      futureStops: futureStops,
      cityLoopRunning: [],
      formingDestination, formingRunID, futureFormingStops, formingTrip
    })
  }

  return outputDepartures
}

module.exports = getMetroDepartures