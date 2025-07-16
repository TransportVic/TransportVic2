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

function tripCrossesCity(prevTrip, nextTrip) {
  return (CROSS_CITY_GROUP_EAST.includes(prevTrip.routeName) && CROSS_CITY_GROUP_WEST.includes(nextTrip.routeName))
    || (CROSS_CITY_GROUP_WEST.includes(prevTrip.routeName) && CROSS_CITY_GROUP_EAST.includes(nextTrip.routeName))
    || (METRO_TUNNEL_GROUP_EAST.includes(prevTrip.routeName) && METRO_TUNNEL_GROUP_WEST.includes(nextTrip.routeName))
    || (METRO_TUNNEL_GROUP_WEST.includes(prevTrip.routeName) && METRO_TUNNEL_GROUP_EAST.includes(nextTrip.routeName))
}

async function getFormingTrip(trip, isArrival, isWithinCityLoop, liveTimetables) {
  let formingDestination = null, formingRunID = null
  let returnedFormingTrip

  let isCrossCityTrip = CROSS_CITY_GROUP_EAST.includes(trip.routeName) || CROSS_CITY_GROUP_WEST.includes(trip.routeName)
  let isMetroTunnelTrip = METRO_TUNNEL_GROUP_EAST.includes(trip.routeName) || METRO_TUNNEL_GROUP_WEST.includes(trip.routeName)
  let upTripInCityLoop = (isWithinCityLoop && trip.direction === 'Up')
  let shouldShowForming = upTripInCityLoop || isCrossCityTrip || isMetroTunnelTrip

  let formingTrip = trip.forming ? await liveTimetables.findDocument({
    mode: trip.mode,
    operationDays: trip.operationDays,
    runID: trip.forming
  }) : null

  if (isArrival) {
    returnedFormingTrip = formingTrip
    formingRunID = trip.forming
  } else if (shouldShowForming) {
    returnedFormingTrip = formingTrip

    if ((isCrossCityTrip || (isMetroTunnelTrip && !upTripInCityLoop)) && returnedFormingTrip) shouldShowForming = tripCrossesCity(trip, returnedFormingTrip)
    if (returnedFormingTrip && shouldShowForming) {
      formingDestination = returnedFormingTrip.destination.slice(0, -16)
      formingRunID = returnedFormingTrip.runID
    } else returnedFormingTrip = null
  }

  let formingType = null
  if (returnedFormingTrip) formingType = upTripInCityLoop ? 'CITY_LOOP' : 'CROSS_CITY'

  return {
    shouldShowForming, formingDestination, formingRunID,
    formingTrip: returnedFormingTrip, formingType
  }
}

module.exports = {
  tripCrossesCity,
  getFormingTrip
}