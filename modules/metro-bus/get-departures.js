const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('timed-cache')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 5 })
const healthCheck = require('../health-check')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const EventEmitter = require('events')
const busStopNameModifier = require('../../load-gtfs/metro-bus/bus-stop-name-modifier')

let tripLoader = {}
let tripCache = {}

async function getStoppingPatternWithCache(db, busDeparture, destination) {
  let id = busDeparture.scheduled_departure_utc + destination

  if (tripLoader[id]) {
    return await new Promise(resolve => tripLoader[id].on('loaded', resolve))
  } else if (!tripCache[id]) {
    tripLoader[id] = new EventEmitter()
    tripLoader[id].setMaxListeners(1000)

    let trip = await getStoppingPattern(db, busDeparture.run_id, 'metro bus', busDeparture.scheduled_departure_utc)

    tripCache[id] = trip
    tripLoader[id].emit('loaded', trip)
    delete tripLoader[id]

    return trip
  } else return tripCache[id]
}

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'metro bus', true)
  let allGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'metro bus', false)
  let mappedDepartures = []
  let now = utils.now()

  await async.forEach(gtfsIDs, async stopGTFSID => {
    //todo put route number as part of route and timetable db
    const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/2/stop/${stopGTFSID}?gtfs=true&max_results=5&expand=run&expand=route`)

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

      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

      if (actualDepartureTime.diff(now, 'minutes') > 120) return

      let destination = busStopNameModifier(run.destination_name)

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, destination, 'metro bus')
      if (!trip) trip = await getStoppingPatternWithCache(db, busDeparture, destination)
      let vehicleDescriptor = run.vehicle_descriptor || {}

      mappedDepartures.push({
        trip,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: trip.destination,
        vehicleDescriptor,
        routeNumber: route.route_number
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'metro bus')

  return (await async.map(gtfsIDs, async gtfsID => {
    return await departureUtils.getScheduledDepartures(gtfsID, db, 'metro bus', 120, false)
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
    departures = await getScheduledDepartures(stop, db, false)

  departuresCache.put(stop.stopName + 'B', departures)
  return departures
}

module.exports = getDepartures
