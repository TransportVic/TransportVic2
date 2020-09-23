const async = require('async')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const gtfsModes = require('../gtfs-modes.json')

async function getRouteData(routes, routeGTFSID, cache) {
  if (cache[routeGTFSID]) return cache[routeGTFSID]
  let routeData = await routes.findDocument({ routeGTFSID }, { routePath: 0 })
  cache[routeGTFSID] = routeData

  return routeData
}

async function getStopData(stops, stopGTFSID, cache) {
  if (cache[stopGTFSID]) return cache[stopGTFSID]
  let stopData = await stops.findDocument({
    'bays.stopGTFSID': stopGTFSID
  }, { bays: 1 })
  let bayData = stopData.bays.find(bay => bay.stopGTFSID === stopGTFSID)

  cache[stopGTFSID] = bayData

  return bayData
}

// Keep it consistent across iterations to prevent overrides and loss of data
let routeDirections = {}

module.exports = async function(collections, gtfsID, trips, tripTimings, calendarDays, calendarDates, direction, routeNumber, routeDetails) {
  let {gtfsTimetables, stops, routes} = collections

  let routeCache = {}, stopCache = {}
  let calendarCache = {}

  let remainingTripTimings = tripTimings.slice(0)
  let isNightBus = gtfsID == 8

  await async.forEachSeries(trips, async trip => {
    let {tripID, routeGTFSID, shapeID} = trip
    let operationDays
    if (calendarCache[trip.calendarID]) operationDays = calendarCache[trip.calendarID]
    else {
      operationDays = gtfsUtils.calendarToDates(calendarDays, calendarDates, trip.calendarID).map(date => utils.getYYYYMMDD(date))
      calendarCache[trip.calendarID] = operationDays
    }

    let ptvDirection = trip.headsign
    if (!routeDirections[routeGTFSID]) routeDirections[routeGTFSID] = {}
    routeDirections[routeGTFSID][ptvDirection] = trip.gtfsDirection

    let timingsIndex = remainingTripTimings.findIndex(tripTiming => tripTiming.tripID === tripID)
    let timings = remainingTripTimings[timingsIndex]
    remainingTripTimings.splice(timingsIndex, 1)

    let previousDepartureTime = -1

    let routeData = await getRouteData(routes, routeGTFSID, routeCache)

    timings.stopTimings = timings.stopTimings.sort((a, b) => a.stopSequence - b.stopSequence)

    let stopTimings = await async.mapSeries(timings.stopTimings, async stopTiming => {
      let {stopGTFSID, stopConditions, stopDistance, stopSequence} = stopTiming

      let stopData = await getStopData(stops, stopGTFSID, stopCache)

      let arrivalTime = stopTiming.arrivalTime.slice(0, 5)
      let departureTime = stopTiming.departureTime.slice(0, 5)

      let arrivalTimeMinutes, departureTimeMinutes

      arrivalTimeMinutes = utils.time24ToMinAftMidnight(arrivalTime)
      departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime)

      if (previousDepartureTime == -1) { // if first stop is already beyond midnight then keep it
        if (isNightBus && arrivalTimeMinutes < 600) {
          arrivalTimeMinutes %= 1440
          departureTimeMinutes %= 1440
        }
      } else {
        arrivalTimeMinutes %= 1440
        departureTimeMinutes %= 1440
      }

      if (arrivalTimeMinutes < previousDepartureTime) arrivalTimeMinutes += 1440
      if (departureTimeMinutes < arrivalTimeMinutes) departureTimeMinutes += 1440

      previousDepartureTime = departureTimeMinutes

      departureTime = utils.minAftMidnightToTime24(departureTimeMinutes)
      arrivalTime = utils.minAftMidnightToTime24(arrivalTimeMinutes)

      return {
        stopName: stopData.fullStopName,
        stopNumber: stopData.stopNumber,
        suburb: stopData.suburb,
        stopGTFSID: stopGTFSID,
        arrivalTime,
        arrivalTimeMinutes,
        departureTime,
        departureTimeMinutes,
        stopConditions,
        stopDistance,
        stopSequence
      }
    })

    let actualMode = (gtfsID === '8') ? 'bus' : gtfsModes[gtfsID]

    let lastStop = stopTimings.slice(-1)[0]

    stopTimings[0].arrivalTime = null
    stopTimings[0].arrivalTimeMinutes = null

    lastStop.departureTime = null
    lastStop.departureTimeMinutes = null

    let tripData = {
      mode: actualMode,
      routeName: routeData.routeName,
      routeNumber: routeNumber ? routeNumber(routeGTFSID, trip.gtfsDirection, stopTimings, routeData.routeNumber) : routeData.routeNumber,
      routeDetails: routeDetails ? routeDetails(routeGTFSID, trip.gtfsDirection) : null,
      tripID,
      routeGTFSID,
      operationDays,
      stopTimings,
      destination: lastStop.stopName,
      destinationArrivalTime: lastStop.arrivalTime,
      origin: stopTimings[0].stopName,
      departureTime: stopTimings[0].departureTime,
      gtfsDirection: trip.gtfsDirection,
      direction: direction ? direction(trip.headsign, routeGTFSID) : null,
      shapeID,
      gtfsMode: parseInt(gtfsID)
    }

    if (trip.runID) tripData.runID = trip.runID
    if (trip.vehicle) tripData.vehicle = trip.vehicle

    await gtfsTimetables.createDocument(tripData)
  })

  routeCache = null
  stopCache = null

  await async.forEach(Object.keys(routeDirections), async routeGTFSID => {
    let directions = routeDirections[routeGTFSID]
    await routes.updateDocument({
      routeGTFSID
    }, {
      $set: {
        ptvDirections: directions
      }
    })
  })
}
