const express = require('express')
const moment = require('moment')
const router = new express.Router()
const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const getStoppingPattern = require('../../../modules/utils/get-stopping-pattern')
const resolveRouteGTFSID = require('../../../modules/resolve-gtfs-id')

const liveBusData = require('../../../additional-data/live-bus-data')
const busDestinations = require('../../../additional-data/bus-destinations')
const coachDestinations = require('../../../additional-data/coach-stops')

const busBays = require('../../../additional-data/bus-bays')

async function pickBestTrip(data, db) {
  let tripDay = utils.parseTime(data.operationDays, 'YYYYMMDD')
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')
  let tripStartMinutes = utils.getPTMinutesPastMidnight(tripStartTime)
  let tripEndTime = utils.parseTime(`${data.operationDays} ${data.destinationArrivalTime}`, 'YYYYMMDD HH:mm')
  let tripEndMinutes = utils.getPTMinutesPastMidnight(tripEndTime)
  if (tripEndTime < tripStartTime) tripEndTime.add(1, 'day') // Because we don't have date stamps on start and end this is required
  if (tripEndMinutes < tripStartMinutes) tripEndMinutes += 1440

  let trueMode = data.mode
  if (trueMode === 'coach') trueMode = 'regional coach'
  if (trueMode === 'heritage') trueMode = 'heritage train'

  let originStop = await db.getCollection('stops').findDocument({
    codedNames: data.origin,
    'bays.mode': trueMode
  })

  let destinationStop = await db.getCollection('stops').findDocument({
    codedNames: data.destination,
    'bays.mode': trueMode
  })
  if (!originStop || !destinationStop) return null
  let minutesToTripStart = tripStartTime.diff(utils.now(), 'minutes')
  let minutesToTripEnd = tripEndTime.diff(utils.now(), 'minutes')

  let originName = originStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.origin)[0].fullStopName
  let destinationName = destinationStop.bays.filter(bay => utils.encodeName(bay.fullStopName) === data.destination)[0].fullStopName

  let operationDays = data.operationDays
  if (tripStartMinutes > 1440) operationDays = utils.getYYYYMMDD(tripDay.clone().add(-1, 'day'))

  let query = {
    mode: trueMode,
    origin: originName,
    departureTime: data.departureTime,
    destination: destinationName,
    destinationArrivalTime: data.destinationArrivalTime,
    operationDays
  }

  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)
  let liveTrip = await db.getCollection('live timetables').findDocument(query)

  let referenceTrip = liveTrip || gtfsTrip
  if (!referenceTrip) {
    if (tripStartMinutes > 1440) {
      query.operationDays = data.operationDays

      gtfsTrip = await db.getCollection('gtfs timetables').findDocument(query)
      liveTrip = await db.getCollection('live timetables').findDocument(query)
      referenceTrip = liveTrip || gtfsTrip

      if (referenceTrip && !referenceTrip.routeGTFSID.startsWith('8-')) return null
    } else {
      return null
    }
  }

  let noLive = ['5', '7', '9', '11', '12', '13']
  let useLive = minutesToTripEnd > -60 && minutesToTripStart < 60

  if (liveTrip) {
    if (liveTrip.type === 'timings' && new Date() - liveTrip.updateTime < 2 * 60 * 1000) {
      let isLive = liveTrip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

      return { trip: liveTrip, tripStartTime, isLive }
    }
  }

  let gtfsMode = referenceTrip.routeGTFSID.split('-')[0]

  if (!useLive || noLive.includes(gtfsMode)
    || (gtfsMode === '4' && liveBusData.metroRoutesExcluded.includes(referenceTrip.routeGTFSID))
    || (gtfsMode === '6' && !liveBusData.regionalRoutes.includes(referenceTrip.routeGTFSID))) return { trip: referenceTrip, tripStartTime, isLive: false }

  let now = utils.now()

  let checkStops = referenceTrip.stopTimings.map(stopTiming => {
    stopTiming.actualDepartureTime = now.clone().startOf('day').add(stopTiming.departureTimeMinutes, 'minutes')
    return stopTiming
  }).filter(stopTiming => {
    return stopTiming.actualDepartureTime.diff(now, 'minutes') > 0
  }).slice(0, -1)

  let checkStop = checkStops[0]

  if (!checkStop) checkStop = referenceTrip.stopTimings[0]

  let checkStopTime = utils.parseTime(`${data.operationDays} ${checkStop.departureTime}`, 'YYYYMMDD HH:mm')
  let isoDeparture = checkStopTime.toISOString()
  let mode = trueMode === 'bus' ? 2 : 1
  try {
    let {departures, routes, runs} = await ptvAPI(`/v3/departures/route_type/${mode}/stop/${checkStop.stopGTFSID}?gtfs=true&date_utc=${tripStartTime.clone().add(-3, 'minutes').startOf('minute').toISOString()}&max_results=5&expand=run&expand=stop&expand=route`)

    let departure = departures.find(departure => {
      let run = runs[departure.run_ref]
      let route = routes[departure.route_id]
      let routeGTFSID = resolveRouteGTFSID(route.route_gtfs_id)

      let destinationName = utils.getProperStopName(run.destination_name)
      let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc).toISOString()

      return scheduledDepartureTime === isoDeparture &&
        destinationName === referenceTrip.destination &&
        routeGTFSID === referenceTrip.routeGTFSID
    })

    if (!departure) return gtfsTrip ? { trip: gtfsTrip, tripStartTime, isLive: false } : null
    let ptvRunID = departure.run_ref
    let departureTime = departure.scheduled_departure_utc

    let trip = await getStoppingPattern(db, ptvRunID, trueMode, departureTime, departure.stop_id, gtfsTrip)
    let isLive = trip.stopTimings.some(stop => !!stop.estimatedDepartureTime)

    return { trip, tripStartTime, isLive }
  } catch (e) {
    return gtfsTrip ? { trip: gtfsTrip, tripStartTime, isLive: false } : null
  }
}

router.get('/:mode/run/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res, next) => {
  if (!['coach', 'bus', 'ferry', 'heritage'].includes(req.params.mode)) return next()

  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  let { trip, tripStartTime, isLive } = tripData

  let routes = res.db.getCollection('routes')
  let tripRoute = await routes.findDocument({ routeGTFSID: trip.routeGTFSID }, { routePath: 0 })
  if (!tripRoute) tripRoute = { operators: [] }
  let operator = (tripRoute.operators.sort((a, b) => a.length - b.length)[0] || '').replace(/ \(.+/, '')

  let {destination, origin} = trip
  let fullDestination = destination
  let fullOrigin = origin

  let destinationShortName = utils.getStopName(destination)
  let originShortName = utils.getStopName(origin)

  if (!utils.isStreet(destinationShortName)) destination = destinationShortName
  if (!utils.isStreet(originShortName)) origin = originShortName

  destination = destination.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')
  origin = origin.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')

  if (trip.mode === 'regional coach') {
    origin = coachDestinations(trip.stopTimings[0])
    destination = coachDestinations(trip.stopTimings.slice(-1)[0])

    let destShortName = utils.getStopName(destination)
    if (!utils.isStreet(destShortName)) destination = destShortName

    let originShortName = utils.getStopName(origin)
    if (!utils.isStreet(originShortName)) origin = originShortName
  } else if (trip.mode == 'bus') {
    let serviceData = busDestinations.service[trip.routeGTFSID] || busDestinations.service[trip.routeNumber] || {}

    destination = serviceData[destination]
      || busDestinations.generic[destination]
      || busDestinations.generic[fullDestination] || destination

    origin = serviceData[origin]
      || busDestinations.generic[origin]
      || busDestinations.generic[fullOrigin] || origin
  }

  let loopDirection
  if (tripRoute.flags)
    loopDirection = tripRoute.flags[trip.gtfsDirection]

  let importantStops = []

  if (trip.mode === 'bus')
    importantStops = trip.stopTimings.map(stop => utils.getStopName(stop.stopName))
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

    if (trip.cancelled) {
      stop.headwayDevianceClass = 'cancelled'
    } else {
      stop.headwayDevianceClass = 'unknown'
    }

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

  if (trip.mode === 'bus') {
    trackerData = await busTrips.findDocument({
      date: req.params.operationDays,
      departureTime: trip.departureTime,
      origin: trip.origin,
      destination: trip.destination
    })
  }

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
