const utils = require('../../utils.js')
const { getDepartures } = require('../departures/get-departures.js')
const { getFormingTrip } = require('./get-forming-trip.js')

const NORTHERN_GROUP = [
  'Werribee',
  'Williamstown',
  'Sunbury',
  'Craigieburn',
  'Upfield',
  'Flemington Racecourse'
]

const CITY_LOOP = [
  'Parliament',
  'Melbourne Central',
  'Flagstaff',
  'Southern Cross'
]

async function getMetroDepartures(station, db, filter, backwards, departureTime, { mode = 'metro train', returnArrivals = false, timeframe = 120 } = {}) {
  let departures = await getDepartures(station, mode, db, { departureTime, returnArrivals, timeframe })
  let liveTimetables = db.getCollection('live timetables')

  let stationName = station.stopName.slice(0, -16)
  let isSSS = stationName === 'Southern Cross'
  let isWithinCityLoop = CITY_LOOP.includes(stationName)

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
    if (!departure.isArrival && destinationStop === currentStop) departure.cancelled = (currentStop.cancelled = true) // Rest of the trip is cancelled so this stop is also cancelled

    // If current stop is cancelled but the trip is still running, show the original details
    if (currentStop.cancelled && !trip.cancelled) {
      updatedOrigin = trueOrigin
      updatedDestination = trueDestination
    } else if (trip.cancelled) {
      updatedDestination = trueDestination
    }

    if (updatedOrigin !== trueOrigin) origin = updatedOrigin
    else origin = trueOrigin

    if (updatedDestination !== trueDestination) destination = updatedDestination
    else destination = trueDestination

    let futureStops = departure.futureStops.map(stop => stop.slice(0, -16))
    let tripHasCityLoop = (NORTHERN_GROUP.includes(trip.routeName) ? isWithinCityLoop && !isSSS : isWithinCityLoop)

    let {
      shouldShowForming,
      formingDestination,
      formingRunID,
      formingTrip,
      formingType
    } = await getFormingTrip(trip, departure.isArrival, tripHasCityLoop, liveTimetables)

    let futureFormingStops = null
    if (formingTrip && shouldShowForming) {
      futureFormingStops = futureStops.concat(
        formingTrip.stopTimings.slice(1).map(stop => stop.stopName.slice(0, -16))
      )
    }

    let routeName = (formingTrip && formingType === 'CITY_LOOP') ? formingTrip.routeName : trip.routeName

    outputDepartures.push({
      ...departure,
      routeName,
      cleanRouteName: utils.encodeName(routeName),
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
      allStops: departure.allStops.map(stop => stop.slice(0, -16)),
      futureStops: futureStops,
      cityLoopRunning: [],
      formingDestination, formingRunID, futureFormingStops,
      formingTrip, formingType
    })
  }

  return outputDepartures
}

module.exports = getMetroDepartures
