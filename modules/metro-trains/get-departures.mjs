import utils from '../../utils.mjs'
import Departures from '../departures/get-departures.mjs'
import { getFormingTrip } from './get-forming-trip.mjs'
import { NORTHERN_GROUP, CITY_LOOP } from './line-groups.mjs'

export class MetroDepartures extends Departures {

  static async fetchScheduledTrips(station, mode, db, departureTime, timeframe = 120) {
    const trips = await super.fetchScheduledTrips(station, mode, db, departureTime, timeframe)

    const hasMetroRRB = trips.some(trip => trip.isRailReplacementBus && trip.isMTMRailTrip)
    if (hasMetroRRB) {
      return trips.filter(trip => !trip.isRailReplacementBus || trip.isMTMRailTrip)
    }
    return trips
  }

}

export default async function getMetroDepartures(station, db, filter, backwards, departureTime, {
  mode = 'metro train',
  returnArrivals = false,
  timeframe = 120,
  DepartureClass = MetroDepartures
} = {}) {
  let departures = await DepartureClass.getDepartures(station, mode, db, {
    departureTime,
    returnArrivals,
    timeframe
  })

  let stationName = station.stopName.slice(0, -16)
  let isSSS = stationName === 'Southern Cross'
  let isWithinCityLoop = CITY_LOOP.includes(stationName)

  let outputDepartures = []
  for (let departure of departures) {
    let { trip, currentStop } = departure

    let par = trip.stopTimings.find(stop => stop.stopName === 'Parliament Railway Station')
    let hasALT = trip.stopTimings.some(stop => stop.stopName === 'Altona Railway Station')

    let origin, trueOrigin, destination, trueDestination
    let isUpTrain = trip.direction === 'Up'

    trueOrigin = (trip.stopTimings.find(stop => !stop.additional) || trip.stopTimings[0]).stopName.slice(0, -16)
    trueDestination = (trip.stopTimings.findLast(stop => !stop.additional) || trip.stopTimings[trip.stopTimings.length - 1]).stopName.slice(0, -16)
    if (!isWithinCityLoop && trueDestination === 'Flinders Street' && isUpTrain && !!par) trueDestination = 'City Loop'

    let updatedOrigin = (trip.stopTimings.find(stop => !stop.cancelled) || trip.stopTimings[0]).stopName.slice(0, -16)
    let destinationStop = (trip.stopTimings.findLast(stop => !stop.cancelled) || trip.stopTimings[trip.stopTimings.length - 1])
    let updatedDestination = destinationStop.stopName.slice(0, -16)

    if (!isWithinCityLoop && updatedDestination === 'Flinders Street' && isUpTrain && !!par && !par.cancelled) updatedDestination = 'City Loop'
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

    let {
      shouldShowForming,
      formingDestination,
      formingRunID,
      formingTrip,
      formingType
    } = await getFormingTrip(trip, departure.isArrival, departure.isLive, isWithinCityLoop, isSSS, db)

    let futureFormingStops = null
    if (formingTrip && shouldShowForming) {
      futureFormingStops = futureStops.concat(
        formingTrip.stopTimings.slice(1).map(stop => stop.stopName.slice(0, -16))
      )
    }

    let routeName = (formingTrip && formingType === 'CITY_LOOP') ? formingTrip.routeName : trip.routeName
    let cleanRouteName = utils.encodeName(routeName)
    let tunnelDirection = null
    if (trip.stopTimings.some(stop => stop.stopName === 'Town Hall Railway Station')) {
      cleanRouteName = 'metro-tunnel'
      let destination = trip.destination.slice(0, -16)
      let origin = trip.origin.slice(0, -16)
      if (trip.routeName === 'Sunbury') tunnelDirection = destination === 'Town Hall' ? 'east' : 'west'
      else tunnelDirection = origin === 'Town Hall' ? 'east' : 'west'
    }

    outputDepartures.push({
      ...departure,
      routeName,
      cleanRouteName,
      fleetNumber: trip.vehicle ? trip.vehicle.consist : null,
      vehicle: trip.vehicle || null,
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
      formingTrip, formingType,
      tunnelDirection
    })
  }

  return outputDepartures
}