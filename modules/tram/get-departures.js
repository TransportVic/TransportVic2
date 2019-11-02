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
const tramFleet = require('../../tram-fleet')

let tripLoader = {}
let tripCache = {}

async function getStoppingPatternWithCache(db, tramDeparture, destination) {
  let id = tramDeparture.scheduled_departure_utc + destination

  if (tripLoader[id]) {
    return await new Promise(resolve => tripLoader[id].on('loaded', resolve))
  } else if (!tripCache[id]) {
    tripLoader[id] = new EventEmitter()
    tripLoader[id].setMaxListeners(1000)

    let trip = await getStoppingPattern(db, tramDeparture.run_id, 'tram', tramDeparture.scheduled_departure_utc)

    tripCache[id] = trip
    tripLoader[id].emit('loaded', trip)
    delete tripLoader[id]

    return trip
  } else return tripCache[id]
}

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'tram', true, false)

  let allGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'tram', false, false)
  let mappedDepartures = []
  let now = utils.now()

  await async.forEach(gtfsIDs, async stopGTFSID => {
    //todo put route number as part of route and timetable db
    const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/1/stop/${stopGTFSID}?gtfs=true&max_results=5&expand=run&expand=route`)

    let seenIDs = []
    await async.forEach(departures, async tramDeparture => {
      if (seenIDs.includes(tramDeparture.run_id)) return
      seenIDs.push(tramDeparture.run_id)
      let run = runs[tramDeparture.run_id]
      let route = routes[tramDeparture.route_id]

      let scheduledDepartureTime = moment.tz(tramDeparture.scheduled_departure_utc, 'Australia/Melbourne')
      let estimatedDepartureTime = tramDeparture.estimated_departure_utc ? moment.tz(tramDeparture.estimated_departure_utc, 'Australia/Melbourne') : null
      let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

      if (actualDepartureTime.diff(now, 'minutes') > 90) return

      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

      let destination = utils.adjustStopname(run.destination_name.trim())
        .replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, '')

      let day = utils.getYYYYMMDD(scheduledDepartureTime)
      let routeGTFSID = route.route_gtfs_id.replace(/-0+/, '-')

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, destination, 'tram', day, routeGTFSID)
      if (!trip) trip = await getStoppingPatternWithCache(db, tramDeparture, run.destination_name),console.log(trip)

      let vehicleDescriptor = run.vehicle_descriptor || {}
      let tram = {}
      if (vehicleDescriptor.id) {
        tram.id = vehicleDescriptor.id
        tram.model = tramFleet.getModel(vehicleDescriptor.id)
        tram.data = tramFleet.data[tram.model]
      }

      mappedDepartures.push({
        trip,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: trip.destination,
        vehicleDescriptor,
        routeNumber: route.route_number === '3-3a' ? '3' : route.route_number,
        tram
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'tram')

  return (await async.map(gtfsIDs, async gtfsID => {
    return await departureUtils.getScheduledDepartures(gtfsID, db, 'tram', 90, false)
  })).reduce((acc, departures) => {
    return acc.concat(departures)
  }, [])
}

async function getDepartures(stop, db) {
  if (departuresCache.get(stop.stopName + 'T')) return departuresCache.get(stop.stopName + 'T')

  let departures
  if (healthCheck.isOnline())
    departures = await getDeparturesFromPTV(stop, db)
  else
    departures = (await getScheduledDepartures(stop, db, false)).map(departure => {
      departure.vehicleDescriptor = {}
      return departure
    })

  departuresCache.put(stop.stopName + 'T', departures)
  return departures
}

module.exports = getDepartures
