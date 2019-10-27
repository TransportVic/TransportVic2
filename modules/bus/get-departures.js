const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('timed-cache')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 1 })
const healthCheck = require('../health-check')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const EventEmitter = require('events')
const busStopNameModifier = require('../../load-gtfs/metro-bus/bus-stop-name-modifier')
const smartrakIDs = require('../../known-smartrak-ids')

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

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', true, false)
  let nightbusGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', true, true)

  let allGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus', false, false)
    .concat(departureUtils.getUniqueGTFSIDs(stop, 'bus', false, true))
  let mappedDepartures = []
  let now = utils.now()

  let gtfsIDPairs = gtfsIDs.map(s => [s, false])
  if (shouldGetNightbus(now))
    gtfsIDPairs = gtfsIDPairs.concat(nightbusGTFSIDs.map(s => [s, true]))

  await async.forEach(gtfsIDPairs, async stopGTFSIDPair => {
    let stopGTFSID = stopGTFSIDPair[0],
        isNightBus = stopGTFSIDPair[1]
    //todo put route number as part of route and timetable db
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
        let smartrakID = vehicleDescriptor.id
        busRego = smartrakIDs[smartrakID]
      }

      mappedDepartures.push({
        trip,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: trip.destination,
        vehicleDescriptor,
        routeNumber: route.route_number,
        busRego,
        isNightBus
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'bus')

  return (await async.map(gtfsIDs, async gtfsID => {
    return await departureUtils.getScheduledDepartures(gtfsID, db, 'bus', 90, false)
  })).reduce((acc, departures) => {
    return acc.concat(departures)
  }, [])
}

async function getDepartures(stop, db) {
  if (departuresCache.get(stop.stopName + 'B')) return departuresCache.get(stop.stopName + 'B')

  let departures
  if (healthCheck.isOnline())
    departures = await getDeparturesFromPTV(stop, db)
  else
    departures = (await getScheduledDepartures(stop, db, false)).map(departure => {
      departure.vehicleDescriptor = {}
      return departure
    })

  departuresCache.put(stop.stopName + 'B', departures)
  return departures
}

module.exports = getDepartures
