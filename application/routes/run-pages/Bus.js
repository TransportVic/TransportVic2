const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const getStoppingPattern = require('../../../modules/bus/get-stopping-pattern')

const busDestinations = require('../../../additional-data/bus-destinations')

const busBays = require('../../../additional-data/bus-data/bus-bays')

const getDepartures = require('../../../modules/bus/get-departures')
const regionalRouteNumbers = require('../../../additional-data/bus-data/regional-with-track')

const overrideStops = require('../../../modules/bus/override-stops')

let regionalGTFSIDs = Object.keys(regionalRouteNumbers).reduce((acc, region) => {
  let regionRoutes = regionalRouteNumbers[region]

  regionRoutes.forEach(route => {
    acc[route.routeGTFSID] = { region, routeNumber: route.routeNumber, liveTrack: route.liveTrack }
  })

  return acc
}, {})

function determineStopType(stop) {
  let busBays = stop.bays.filter(bay => bay.mode === 'bus')
  let screenServices = busBays.map(bay => bay.screenServices).reduce((a, e) => a.concat(e), [])
  let stopType = ''

  if (screenServices.some(svc => svc.routeGTFSID.startsWith('4-'))) {
    stopType = 'metro'
  } else { // Regional/Skybus
    if (screenServices.some(svc => regionalGTFSIDs[svc.routeGTFSID] && regionalGTFSIDs[svc.routeGTFSID].liveTrack)) {
      stopType = 'regional-live'
    } else {
      stopType = 'regional'
    }
  }

  return { stopType, screenServices }
}

async function pickBestTrip(data, db) {
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)

  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440
  if (tripStartMinutes >= 1440) tripDay.add(-1, 'day')
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required

  let dbStops = db.getCollection('stops')

  let possibleOriginStops = await dbStops.findDocuments({
    codedNames: data.origin,
    'bays.mode': 'bus'
  }).toArray()

  let possibleDestinationStops = await dbStops.findDocuments({
    codedNames: data.destination,
    'bays.mode': 'bus'
  }).toArray()

  if (!possibleOriginStops.length || !possibleDestinationStops.length) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')
  let minutesToTripEnd = tripEndTime.diff(utils.now(), 'minutes')

  let originBay = possibleOriginStops.map(stop => stop.bays.find(bay => utils.encodeName(bay.fullStopName) === data.origin)).find(bay => bay)
  let destinationBay = possibleDestinationStops.map(stop => stop.bays.find(bay => utils.encodeName(bay.fullStopName) === data.destination)).find(bay => bay)

  let originStop = possibleOriginStops.find(stop => stop.bays.includes(originBay))

  let operationDays = utils.getYYYYMMDD(tripDay)

  let query = {
    mode: 'bus',
    origin: originBay.fullStopName,
    departureTime: data.departureTime,
    destination: destinationBay.fullStopName,
    destinationArrivalTime: data.destinationArrivalTime,
    operationDays
  }

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)
  let liveTrip = await db.getCollection('live timetables').findDocument(query)

  let referenceTrip = liveTrip || gtfsTrip

  let useLive = minutesToTripEnd > -60 && minutesToTripStart < 60

  if (liveTrip) {
    if (liveTrip.type === 'timings' && new Date() - liveTrip.updateTime < 2 * 60 * 1000) {
      let isLive = liveTrip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

      return { trip: liveTrip, tripStartTime, isLive }
    }
  }

  let isLiveRoute = null
  if (referenceTrip) {
    isLiveRoute = referenceTrip.routeGTFSID.startsWith('4-') || !!regionalGTFSIDs[referenceTrip.routeGTFSID]
  }

  // Necessary to make distinction between false and null
  // null - unknown, false - confirmed to be false
  if (!useLive || (isLiveRoute === false)) return { trip: referenceTrip, tripStartTime, isLive: false }

  if (!isLiveRoute) { // Reference trip does not exist
    let originStopType = determineStopType(originStop)
    if (originStopType === 'regional') return null // Trip does not exist, would not suddenly appear on PTV's end so assume it does not exist
    // Otherwise could be trip added on the day that we do not have, although this is very unlikely
  }

  let now = utils.now()

  try {
    let ptvRunID

    if (!referenceTrip || !referenceTrip.runID) {
      // Avoid requesting the full stop but also avoid wrongly caching only a single bay
      let trueOriginBay

      if (referenceTrip) { // Needs to ensure other services still match
        let originGTFSID = referenceTrip.stopTimings[0].stopGTFSID
        let originBay = originStop.bays.find(bay => bay.stopGTFSID === originGTFSID)
        trueOriginBay = originStop.bays.filter(bay => bay.originalName === originBay.originalName)
      } else { // No way to actually know which bay it departs from - hence we need to request all
        trueOriginBay = originStop.bays
      }

      let mockedStop = {
        cleanSuburbs: originStop.cleanSuburbs,
        stopName: `TRIP.${originStop.stopName}.${originBay.stopGTFSID}`,
        bays: trueOriginBay
      }

      let affectedStops = Object.values(overrideStops).map(stop => stop.stop_name)
      let originStopToUse = mockedStop
      if (affectedStops.some(affected => originStop.stopName.includes(affected) || affected.includes(originStop.stopName))) {
        originStopToUse = originStop
      }

      let originDepartures = await getDepartures(originStopToUse, db, tripStartTime.clone().add(-5, 'minutes'), true)

      let matchingDeparture = originDepartures.find(departure => {
        let trip = departure.trip

        if (trip.departureTime !== data.departureTime) return false
        if (trip.destinationArrivalTime !== data.destinationArrivalTime) return false
        if (trip.origin !== originBay.fullStopName) return false
        if (trip.destination !== destinationBay.fullStopName) return false

        return true
      })

      if (matchingDeparture) {
        if (matchingDeparture.runID) ptvRunID = matchingDeparture.runID
        else ptvRunID = -1
      }
    } else if (referenceTrip && referenceTrip.runID) ptvRunID = referenceTrip.runID

    if (!ptvRunID && referenceTrip) {
      let isLive = referenceTrip.stopTimings.some(stop => !!stop.estimatedDepartureTime)
      return { trip: referenceTrip, tripStartTime, isLive } // Request must have failed, but we have a reference trip
    }
    // if (!ptvRunID) return null // Available options to get ptvRunID unsuccessful - trip does not exist

    let trip = await getStoppingPattern({
      ptvRunID,
      referenceTrip: gtfsTrip
    }, db)

    let isLive = trip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

    return { trip, tripStartTime, isLive }
  } catch (e) {
    global.loggers.general.err('Failed to get Bus trip', e)

    let isLive = referenceTrip.stopTimings.some(stop => !!stop.estimatedDepartureTime)
    return referenceTrip ? { trip: referenceTrip, tripStartTime, isLive } : null
  }
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res, next) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  let { trip, tripStartTime, isLive } = tripData

  let routes = res.db.getCollection('routes')
  let tripRoute = await routes.findDocument({ routeGTFSID: trip.routeGTFSID }, { routePath: 0 })
  if (!tripRoute) tripRoute = { operators: [] }
  let operator = (tripRoute.operators.sort((a, b) => a.length - b.length)[0] || '')

  let {destination, origin} = trip
  let fullDestination = destination
  let fullOrigin = origin

  let destinationShortName = utils.getStopName(destination)
  let originShortName = utils.getStopName(origin)

  if (!utils.isStreet(destinationShortName)) destination = destinationShortName
  if (!utils.isStreet(originShortName)) origin = originShortName

  destination = destination.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')
  origin = origin.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')

  let serviceData = busDestinations.service[trip.routeGTFSID] || busDestinations.service[trip.routeNumber] || {}

  destination = serviceData[destination]
    || busDestinations.generic[destination]
    || busDestinations.generic[fullDestination] || destination

  origin = serviceData[origin]
    || busDestinations.generic[origin]
    || busDestinations.generic[fullOrigin] || origin

  let loopDirection
  if (tripRoute.flags)
    loopDirection = tripRoute.flags[trip.gtfsDirection]

  let importantStops = trip.stopTimings.map(stop => utils.getStopName(stop.stopName))
      .filter((e, i, a) => a.indexOf(e) === i)
      .slice(1, -1)
      .filter(utils.isCheckpointStop)
      .map(utils.shorternStopName)

  let viaText
  if (importantStops.length)
    viaText = `Via ${importantStops.slice(0, -1).join(', ')}${(importantStops.length > 1 ? ' & ' : '') + importantStops.slice(-1)[0]}`

  let firstDepartureTime = trip.stopTimings[0].departureTimeMinutes
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.pretyTimeToDeparture = ''
    stop.headwayDevianceClass = 'unknown'

    if (!isLive || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = tripStartTime.clone().add((stop.departureTimeMinutes || stop.arrivalTimeMinutes) - firstDepartureTime, 'minutes')
      let estimatedDepartureTime = stop.estimatedDepartureTime

      stop.headwayDevianceClass = utils.findHeadwayDeviance(scheduledDepartureTime, estimatedDepartureTime, {
        early: 2,
        late: 5
      })

      stop.pretyTimeToDeparture = utils.prettyTime(estimatedDepartureTime || scheduledDepartureTime, true, true)
    }

    stop.bay = busBays[stop.stopGTFSID]

    return stop
  })


  let routeNumber = trip.routeNumber
  let routeNumberClass = utils.encodeName(operator)
  let trackerData
  let busTrips = res.db.getCollection('bus trips')

  trackerData = await busTrips.findDocument({
    date: req.params.operationDays,
    departureTime: trip.departureTime,
    origin: trip.origin,
    destination: trip.destination
  })

  if (trip.vehicle && !trackerData) {
    let {routeGTFSID, origin, destination, departureTime, destinationArrivalTime} = trip
    let smartrakID = parseInt(trip.vehicle)

    trackerData = {
      date: req.params.operationDays,
      timestamp: +new Date(),
      routeGTFSID,
      smartrakID,
      routeNumber,
      origin, destination, departureTime, destinationArrivalTime
    }

    await busTrips.replaceDocument({
      date: req.params.operationDays,
      routeGTFSID, origin, destination, departureTime, destinationArrivalTime
    }, trackerData, {
      upsert: true
    })
  }

  if (trackerData) {
    let smartrakIDs = res.db.getCollection('smartrak ids')

    let busRego = (await smartrakIDs.findDocument({
      smartrakID: trackerData.smartrakID
    }) || {}).fleetNumber

    if (busRego) {
      trip.vehicleData = {
        name: 'Bus #' + busRego
      }
    }
  }

  res.render('runs/generic', {
    trip,
    shorternStopName: utils.shorternStopName,
    origin,
    destination,
    routeNumberClass,
    loopDirection,
    viaText,
    routeNumber
  })
})

module.exports = router
