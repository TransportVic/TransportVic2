const { getDepartures } = require('../departures/get-departures')

const CITY_LOOP = [
  'Parliament',
  'Melbourne Central',
  'Flagstaff',
  'Southern Cross'
]
const CROSS_CITY_GROUP_EAST = [
  'Frankston',
  'Sandringham'
]
const CROSS_CITY_GROUP_WEST = [
  'Werribee',
  'Williamstown'
]

const METRO_TUNNEL_GROUP_EAST = [
  'Pakenham',
  'Cranbourne'
]
const METRO_TUNNEL_GROUP_WEST = [
  'Sunbury'
]

async function getMetroDepartures(station, db, filter, backwards, departureTime, { mode = 'metro train', returnArrivals = false, timeframe = 120 } = {}) {
  let departures = await getDepartures(station, mode, db, { departureTime, returnArrivals, timeframe })
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
    if (!departure.isArrival && destinationStop === currentStop) departure.cancelled = (currentStop.cancelled = true) // Rest of the trip is cancelled so this stop is also cancelled

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
    let returnedFormingTrip

    let isCrossCityTrip = CROSS_CITY_GROUP_EAST.includes(trip.routeName) || CROSS_CITY_GROUP_WEST.includes(trip.routeName)
    let isMetroTunnelTrip = METRO_TUNNEL_GROUP_EAST.includes(trip.routeName) || METRO_TUNNEL_GROUP_WEST.includes(trip.routeName)
    let upTripInCityLoop = (isWithinCityLoop && trip.direction === 'Up')
    let shouldShowForming = upTripInCityLoop || isCrossCityTrip || isMetroTunnelTrip

    let formingTrip = trip.forming ? await liveTimetables.findDocument({
      mode: mode,
      operationDays: trip.operationDays,
      runID: trip.forming
    }) : null

    if (departure.isArrival) {
      returnedFormingTrip = formingTrip
      formingRunID = trip.forming
    } else if (shouldShowForming) {
      returnedFormingTrip = formingTrip

      if (isCrossCityTrip && returnedFormingTrip) shouldShowForming = 
        (CROSS_CITY_GROUP_EAST.includes(trip.routeName) && CROSS_CITY_GROUP_WEST.includes(returnedFormingTrip.routeName))
        || (CROSS_CITY_GROUP_WEST.includes(trip.routeName) && CROSS_CITY_GROUP_EAST.includes(returnedFormingTrip.routeName))
      else if (isMetroTunnelTrip && returnedFormingTrip && !upTripInCityLoop) shouldShowForming =
        (METRO_TUNNEL_GROUP_EAST.includes(trip.routeName) && METRO_TUNNEL_GROUP_WEST.includes(returnedFormingTrip.routeName))
        || (METRO_TUNNEL_GROUP_WEST.includes(trip.routeName) && METRO_TUNNEL_GROUP_EAST.includes(returnedFormingTrip.routeName))

      if (returnedFormingTrip && shouldShowForming) {
        formingDestination = returnedFormingTrip.destination.slice(0, -16)
        formingRunID = returnedFormingTrip.runID
        futureFormingStops = futureStops.concat(
          returnedFormingTrip.stopTimings.slice(1).map(stop => stop.stopName.slice(0, -16))
        )
      } else returnedFormingTrip = null
    }

    let formingType = null
    if (returnedFormingTrip) formingType = upTripInCityLoop ? 'CITY_LOOP' : 'CROSS_CITY'

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
      allStops: departure.allStops.map(stop => stop.slice(0, -16)),
      futureStops: futureStops,
      cityLoopRunning: [],
      formingDestination, formingRunID, futureFormingStops,
      formingTrip: returnedFormingTrip, formingType
    })
  }

  return outputDepartures
}

module.exports = getMetroDepartures
