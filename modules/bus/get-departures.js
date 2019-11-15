const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('timed-cache')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 1 })
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const EventEmitter = require('events')
const busStopNameModifier = require('../../load-gtfs/metro-bus/bus-stop-name-modifier')
const busBays = require('./bus-bays')
const busMinderIntegrator = require('./busminder-integrator')

let tripLoader = {}
let tripCache = {}

async function getStoppingPatternWithCache(db, busDeparture, destination, isNightBus) {
  let id = busDeparture.scheduled_departure_utc + destination

  if (tripLoader[id]) {
    return await new Promise(resolve => tripLoader[id].on('loaded', resolve))
  } else if (!tripCache[id]) {
    tripLoader[id] = new EventEmitter()
    tripLoader[id].setMaxListeners(1000)

    let trip = await getStoppingPattern(db, busDeparture.run_id, isNightBus ? 'nbus' : 'bus', busDeparture.scheduled_departure_utc)

    tripCache[id] = trip
    tripLoader[id].emit('loaded', trip)
    delete tripLoader[id]

    return trip
  } else return tripCache[id]
}

function shouldGetNightbus(now) {
  let minutesAfterMidnight = utils.getPTMinutesPastMidnight(now)
  let dayOfWeek = utils.getDayName(now)

  // 11pm - 7.55am (last 969 runs 6.30am - 7.35am, give some buffer for lateness?)
  if (dayOfWeek == 'Fri')
    return minutesAfterMidnight >= 1380
  if (dayOfWeek == 'Sat')
    return minutesAfterMidnight >= 1380 || minutesAfterMidnight <= 475
  if (dayOfWeek == 'Sun')
    return minutesAfterMidnight <= 475
  return false
}

async function updateBusTrips(db, departures) {
  let busTrips = db.getCollection('bus trips')

  let date = utils.getYYYYMMDDNow()
  let timestamp = +new Date()

  let viableDepartures = departures.filter(d => d.vehicleDescriptor.id)

  await async.forEach(viableDepartures, async departure => {
    let {routeGTFSID, origin, destination, departureTime, destinationArrivalTime} = departure.trip
    let smartrakID = parseInt(departure.vehicleDescriptor.id)
    let {routeNumber} = departure

    let data = {
      date, timestamp,
      routeGTFSID,
      smartrakID, routeNumber,
      origin, destination, departureTime, destinationArrivalTime
    }

    await busTrips.replaceDocument({
      date, routeGTFSID, origin, destination, departureTime, destinationArrivalTime
    }, data, {
      upsert: true
    })
  })
}

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let smartrakIDs = db.getCollection('smartrak ids')
  let dbRoutes = db.getCollection('routes')

  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', true, false)
  let nightbusGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', true, true)

  let allGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', false, false)
    .concat(departureUtils.getUniqueGTFSIDs(stop, 'bus', false, true))
  let mappedDepartures = []
  let now = utils.now()

  let gtfsIDPairs = gtfsIDs.map(s => [s, false])
  if (shouldGetNightbus(now))
    gtfsIDPairs = gtfsIDPairs.concat(nightbusGTFSIDs.map(s => [s, true]))

  let isCheckpointStop = utils.isCheckpointStop(stop.stopName)

  await async.forEach(gtfsIDPairs, async stopGTFSIDPair => {
    let stopGTFSID = stopGTFSIDPair[0],
        isNightBus = stopGTFSIDPair[1]
    //todo put route number as part of route and timetable db
    // let requestTime = now.clone().add(-1, 'mintues').toISOString()
    const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/${isNightBus ? 4 : 2}/stop/${stopGTFSID}?gtfs=true&max_results=5&expand=run&expand=route`)

    let seenIDs = []
    await async.forEach(departures, async busDeparture => {
      if (seenIDs.includes(busDeparture.run_id)) return
      seenIDs.push(busDeparture.run_id)
      let run = runs[busDeparture.run_id]
      let route = routes[busDeparture.route_id]

      if (route.route_number.toLowerCase().includes('combined')) return

      let scheduledDepartureTime = moment.tz(busDeparture.scheduled_departure_utc, 'Australia/Melbourne')
      let estimatedDepartureTime = busDeparture.estimated_departure_utc ? moment.tz(busDeparture.estimated_departure_utc, 'Australia/Melbourne') : null
      let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

      // if early at checkpoint set to on time
      if (estimatedDepartureTime && isCheckpointStop) {
        if (scheduledDepartureTime - estimatedDepartureTime > 0) {
          estimatedDepartureTime = scheduledDepartureTime
          actualDepartureTime = estimatedDepartureTime
        }
      }

      if (actualDepartureTime.diff(now, 'minutes') > 90) return

      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

      let destination = busStopNameModifier(utils.adjustStopname(run.destination_name.trim()))

      let day = utils.getYYYYMMDD(scheduledDepartureTime)
      if (isNightBus && (scheduledDepartureTimeMinutes % 1440) < 180)
        day = utils.getYYYYMMDD(scheduledDepartureTime.clone().add(1, 'day'))

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, destination, 'bus', day, route.route_gtfs_id)
      if (!trip) trip = await getStoppingPatternWithCache(db, busDeparture, destination, isNightBus)
      let vehicleDescriptor = run.vehicle_descriptor || {}

      let busRego
      if (vehicleDescriptor.supplier === 'Smartrak') {
        busRego = (await smartrakIDs.findDocument({
          smartrakID: parseInt(vehicleDescriptor.id)
        }) || {}).fleetNumber
      }

      let isBusMinderOverride = false
      if (!busRego) {
        busRego = await busMinderIntegrator(trip)
        isBusMinderOverride = !!busRego
      }

      let busRoute = await dbRoutes.findDocument({ routeGTFSID: route.route_gtfs_id })
      let operator = busRoute.operators.sort((a, b) => a.length - b.length)[0]

      let routeNumber = route.route_number.replace(/_x$/, '')
      let sortNumber = routeNumber

      if (route.route_gtfs_id.startsWith('7-')) {
        routeNumber = route.route_gtfs_id.slice(2)
        sortNumber = routeNumber.slice(2)
      }

      mappedDepartures.push({
        trip,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: trip.destination,
        vehicleDescriptor,
        routeNumber,
        sortNumber,
        busRego,
        isNightBus,
        operator,
        codedOperator: utils.encodeName(operator.replace(/ \(.+/, '')),
        isBusMinderOverride
      })
    })
  })

  let sortedDepartures = mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)

  let tripIDs = []
  let filteredDepartures = sortedDepartures.filter(d => {
    if (!tripIDs.includes(d.trip.tripID)) {
      tripIDs.push(d.trip.tripID)
      return true
    } else return false
  })

  await updateBusTrips(db, filteredDepartures)
  return filteredDepartures
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'bus', 90, false)
}

async function getDepartures(stop, db) {
  if (departuresCache.get(stop.stopName + 'B')) return departuresCache.get(stop.stopName + 'B')

  let departures
  let shouldCache = true
  try {
    departures = await getDeparturesFromPTV(stop, db)
  } catch (e) {
    console.log(e)
    shouldCache = false
    departures = (await getScheduledDepartures(stop, db, false)).map(departure => {
      departure.vehicleDescriptor = {}
      return departure
    })
  }

  let nightBusIncluded = shouldGetNightbus(utils.now())
  let shouldShowRoad = stop.bays.filter(bay => {
    return bay.mode === 'bus'
      && (nightBusIncluded ^ !(bay.flags && bay.flags.isNightBus && !bay.flags.hasRegularBus))
  }).map(bay => bay.fullStopName).filter((e, i, a) => a.indexOf(e) === i).length > 1

  departures = departures.map(departure => {
    let {trip} = departure
    let departureBayID = trip.stopTimings[0].stopGTFSID
    let bay = busBays[departureBayID]
    let departureRoad = trip.stopTimings[0].stopName.split('/')[1]

    departure.bay = bay
    departure.departureRoad = departureRoad

    let importantStops = trip.stopTimings.slice(1, -1).map(stop => stop.stopName)
      .filter(utils.isCheckpointStop)
      .map(utils.shorternStopName)
      .filter((e, i, a) => a.indexOf(e) === i)

    if (importantStops.length)
      departure.viaText = `Via ${importantStops.slice(0, -1).join(', ')}${(importantStops.length > 1 ? ' & ' : '') + importantStops.slice(-1)[0]}`

    if (shouldShowRoad && departure.departureRoad) {
      departure.guidanceText = 'Departs ' + departure.departureRoad
    }

    return departure
  })

  if (shouldCache)
    departuresCache.put(stop.stopName + 'B', departures)
  return departures
}

module.exports = getDepartures
