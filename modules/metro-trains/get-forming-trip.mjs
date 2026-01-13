import {
  METRO_TUNNEL_GROUP_EAST,
  METRO_TUNNEL_GROUP_WEST,
  NORTHERN_GROUP,
  CROSS_CITY_GROUP_EAST,
  CROSS_CITY_GROUP_WEST,
  MURL
} from './line-groups.mjs'

const CLIFTON_HILL_GROUP = [
  'Hurstbridge',
  'Mernda'
]

export function tripCrossesCity(prevTrip, nextTrip) {
  return (CROSS_CITY_GROUP_EAST.includes(prevTrip.routeName) && CROSS_CITY_GROUP_WEST.includes(nextTrip.routeName))
    || (CROSS_CITY_GROUP_WEST.includes(prevTrip.routeName) && CROSS_CITY_GROUP_EAST.includes(nextTrip.routeName))
    || (METRO_TUNNEL_GROUP_EAST.includes(prevTrip.routeName) && METRO_TUNNEL_GROUP_WEST.includes(nextTrip.routeName))
    || (METRO_TUNNEL_GROUP_WEST.includes(prevTrip.routeName) && METRO_TUNNEL_GROUP_EAST.includes(nextTrip.routeName))
}

export function checkIsCHLFormingCCLSpecialCase(trip, formingTrip) {
  if (CLIFTON_HILL_GROUP.includes(trip.routeName) && trip.direction === 'Down' && formingTrip) {
    let lastNonAMEX = trip.stopTimings.findLast(stop => !stop.cancelled)
    let isTerminatingPAR = lastNonAMEX && lastNonAMEX.stopName === 'Parliament Railway Station' && lastNonAMEX.stopName !== trip.destination
    let formingTripsIsCCL = formingTrip.routeName === 'City Circle' || !!(formingTrip.runID && formingTrip.runID.match(/^0[789]\d\d$/))
    return isTerminatingPAR && formingTripsIsCCL && formingTrip.origin === lastNonAMEX.stopName
  }

  return false
}

export function nextTripHasLoop(formingTrip) {
  return formingTrip.stopTimings.some(stop => MURL.includes(stop.stopName.slice(0, -16)))
}

export async function getFormingTripData(trip, isLiveDeparture, db) {
  const liveTimetables = db.getCollection('live timetables')
  const gtfsTimetables = db.getCollection('gtfs timetables')

  if (isLiveDeparture) {
    return trip.forming ? await liveTimetables.findDocument({
      mode: trip.mode,
      operationDays: trip.operationDays,
      runID: trip.forming
    }) : null
  } else {
    return trip.block ? await gtfsTimetables.findDocuments({
      mode: trip.mode,
      operationDays: trip.operationDays,
      block: trip.block,
      departureTime: { $gte: trip.destinationArrivalTime }
    }).sort({ departureTime: 1 }).next() : null
  }
}

export async function getFormedByTripData(trip, isLiveDeparture, db) {
  const liveTimetables = db.getCollection('live timetables')
  const gtfsTimetables = db.getCollection('gtfs timetables')

  if (isLiveDeparture) {
    return trip.formedBy ? await liveTimetables.findDocument({
      mode: trip.mode,
      operationDays: trip.operationDays,
      runID: trip.formedBy
    }) : null
  } else {
    return trip.block ? await gtfsTimetables.findDocuments({
      mode: trip.mode,
      operationDays: trip.operationDays,
      block: trip.block,
      destinationArrivalTime: { $lte: trip.departureTime }
    }).sort({ departureTime: -1 }).next() : null
  }
}


export async function getFormingTrip(trip, isArrival, isLiveDeparture, isWithinCityLoop, isSSS, db) {
  let formingDestination = null, formingRunID = null
  let returnedFormingTrip

  let isCityCircle = trip.routeName === 'City Circle' || !!(trip.runID && trip.runID.match(/^0[789]\d\d$/))
  let isCrossCityTrip = CROSS_CITY_GROUP_EAST.includes(trip.routeName) || CROSS_CITY_GROUP_WEST.includes(trip.routeName)
  let isMetroTunnelTrip = METRO_TUNNEL_GROUP_EAST.includes(trip.routeName) || METRO_TUNNEL_GROUP_WEST.includes(trip.routeName)
  let isNorthernTrip = NORTHERN_GROUP.includes(trip.routeName)
  let upTripInCityLoop = (isWithinCityLoop && trip.direction === 'Up')
  let shouldShowForming = (upTripInCityLoop || isCrossCityTrip || isMetroTunnelTrip) && !isCityCircle
  let isCHLFormingCCLSpecialCase

  let formingTrip = await getFormingTripData(trip, isLiveDeparture, db)
  
  if (!shouldShowForming) {
    isCHLFormingCCLSpecialCase = checkIsCHLFormingCCLSpecialCase(trip, formingTrip)
    shouldShowForming = isCHLFormingCCLSpecialCase
  }

  if (isArrival) {
    returnedFormingTrip = formingTrip
    formingRunID = trip.forming
  } else if (shouldShowForming) {
    returnedFormingTrip = formingTrip

    const crossesCity = returnedFormingTrip && tripCrossesCity(trip, returnedFormingTrip)

    if (returnedFormingTrip && ((isCrossCityTrip && !upTripInCityLoop) || (isMetroTunnelTrip && !upTripInCityLoop))) shouldShowForming = crossesCity
    else if (returnedFormingTrip && isNorthernTrip && upTripInCityLoop && isSSS && !crossesCity) shouldShowForming = nextTripHasLoop(returnedFormingTrip)

    const applyForming = returnedFormingTrip
      && shouldShowForming
      && !(upTripInCityLoop && trip.cancelled)

    if (applyForming) {
      formingDestination = returnedFormingTrip.destination.slice(0, -16)
      formingRunID = returnedFormingTrip.runID
    } else returnedFormingTrip = null
  }

  let formingType = null
  if (returnedFormingTrip) formingType = (upTripInCityLoop || isCHLFormingCCLSpecialCase) ? 'CITY_LOOP' : 'CROSS_CITY'

  return {
    shouldShowForming, formingDestination, formingRunID,
    formingTrip: returnedFormingTrip, formingType
  }
}

export default {
  tripCrossesCity,
  getFormingTrip,
  checkIsCHLFormingCCLSpecialCase
}