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

const CLIFTON_HILL_GROUP = [
  'Hurstbridge',
  'Mernda'
]

function tripCrossesCity(prevTrip, nextTrip) {
  return (CROSS_CITY_GROUP_EAST.includes(prevTrip.routeName) && CROSS_CITY_GROUP_WEST.includes(nextTrip.routeName))
    || (CROSS_CITY_GROUP_WEST.includes(prevTrip.routeName) && CROSS_CITY_GROUP_EAST.includes(nextTrip.routeName))
    || (METRO_TUNNEL_GROUP_EAST.includes(prevTrip.routeName) && METRO_TUNNEL_GROUP_WEST.includes(nextTrip.routeName))
    || (METRO_TUNNEL_GROUP_WEST.includes(prevTrip.routeName) && METRO_TUNNEL_GROUP_EAST.includes(nextTrip.routeName))
}

function checkIsCHLFormingCCLSpecialCase(trip, formingTrip) {
  if (CLIFTON_HILL_GROUP.includes(trip.routeName) && trip.direction === 'Down' && formingTrip) {
    let lastNonAMEX = trip.stopTimings.findLast(stop => !stop.cancelled)
    let isTerminatingPAR = lastNonAMEX && lastNonAMEX.stopName === 'Parliament Railway Station' && lastNonAMEX.stopName !== trip.destination
    let formingTripsIsCCL = formingTrip.routeName === 'City Circle' || !!(formingTrip.runID && formingTrip.runID.match(/^0[789]\d\d$/))
    return isTerminatingPAR && formingTripsIsCCL && formingTrip.origin === lastNonAMEX.stopName
  }

  return false
}

async function getFormingTrip(trip, isArrival, isWithinCityLoop, liveTimetables) {
  let formingDestination = null, formingRunID = null
  let returnedFormingTrip

  let isCityCircle = trip.routeName === 'City Circle' || !!(trip.runID && trip.runID.match(/^0[789]\d\d$/))
  let isCrossCityTrip = CROSS_CITY_GROUP_EAST.includes(trip.routeName) || CROSS_CITY_GROUP_WEST.includes(trip.routeName)
  let isMetroTunnelTrip = METRO_TUNNEL_GROUP_EAST.includes(trip.routeName) || METRO_TUNNEL_GROUP_WEST.includes(trip.routeName)
  let upTripInCityLoop = (isWithinCityLoop && trip.direction === 'Up')
  let shouldShowForming = (upTripInCityLoop || isCrossCityTrip || isMetroTunnelTrip) && !isCityCircle
  let isCHLFormingCCLSpecialCase

  let formingTrip = trip.forming ? await liveTimetables.findDocument({
    mode: trip.mode,
    operationDays: trip.operationDays,
    runID: trip.forming
  }) : null

  if (!shouldShowForming) {
    isCHLFormingCCLSpecialCase = checkIsCHLFormingCCLSpecialCase(trip, formingTrip)
    shouldShowForming = isCHLFormingCCLSpecialCase
  }

  if (isArrival) {
    returnedFormingTrip = formingTrip
    formingRunID = trip.forming
  } else if (shouldShowForming) {
    returnedFormingTrip = formingTrip

    if ((isCrossCityTrip || (isMetroTunnelTrip && !upTripInCityLoop)) && returnedFormingTrip) shouldShowForming = tripCrossesCity(trip, returnedFormingTrip)
    if (returnedFormingTrip && shouldShowForming && !(upTripInCityLoop && trip.cancelled)) {
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

module.exports = {
  tripCrossesCity,
  getFormingTrip,
  checkIsCHLFormingCCLSpecialCase
}