const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('../../TimedCache')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const EventEmitter = require('events')
const tramFleet = require('../../tram-fleet')
const determineTramRouteNumber = require('./determine-tram-route-number')

const departuresCache = new TimedCache(1000 * 30)

let tripLoader = {}
let tripCache = {}

let ptvAPILocks = {}

async function getStoppingPatternWithCache(db, tramDeparture, destination) {
  let id = tramDeparture.scheduled_departure_utc + destination

  if (tripLoader[id]) {
    return await new Promise(resolve => tripLoader[id].on('loaded', resolve))
  } else if (!tripCache[id]) {
    tripLoader[id] = new EventEmitter()
    tripLoader[id].setMaxListeners(1000)

    let trip = await getStoppingPattern(db, tramDeparture.run_ref, 'tram', tramDeparture.scheduled_departure_utc)

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
    const {departures, runs, routes} = await ptvAPI(`/v3/departures/route_type/1/stop/${stopGTFSID}?gtfs=true&max_results=6&look_backwards=false&include_cancelled=true&expand=run&expand=route&expand=VehicleDescriptor`)

    let seenIDs = []
    await async.forEach(departures, async tramDeparture => {
      if (seenIDs.includes(tramDeparture.run_ref)) return
      seenIDs.push(tramDeparture.run_ref)
      let run = runs[tramDeparture.run_ref]
      let route = routes[tramDeparture.route_id]

      let scheduledDepartureTime = utils.parseTime(tramDeparture.scheduled_departure_utc)
      let estimatedDepartureTime = tramDeparture.estimated_departure_utc ? utils.parseTime(tramDeparture.estimated_departure_utc) : null
      let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

      if (actualDepartureTime.diff(now, 'minutes') > 90) return

      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime) % 1440

      let destination = utils.getProperStopName(run.destination_name)

      let day = utils.getYYYYMMDD(scheduledDepartureTime)
      let routeGTFSID = route.route_gtfs_id.replace(/-0+/, '-')

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, destination, 'tram', day, routeGTFSID)
      if (!trip) trip = await getStoppingPatternWithCache(db, tramDeparture, run.destination_name)

      let tripDestination = trip.stopTimings.slice(-1)[0].stopGTFSID
      let tripOrigin = trip.stopTimings[0].stopGTFSID

      if (allGTFSIDs.includes(tripDestination) && !allGTFSIDs.includes(tripOrigin)) return

      let vehicleDescriptor = run.vehicle_descriptor || {}
      let tram = {}
      if (vehicleDescriptor.id) {
        if (vehicleDescriptor.id !== '0') {
          tram.id = vehicleDescriptor.id
          tram.model = tramFleet.getModel(vehicleDescriptor.id)
          tram.data = tramFleet.data[tram.model]
        } else {
          vehicleDescriptor = {}
          estimatedDepartureTime = null
          actualDepartureTime = scheduledDepartureTime

          if (scheduledDepartureTime.diff(now, 'minutes') > 90) return
        }
      }

      let routeNumber = determineTramRouteNumber(trip)
      let sortNumber = parseInt(routeNumber.replace(/[a-z]/, ''))
      let loopDirection = null

      if (routeGTFSID === '3-35') {
        loopDirection = trip.gtfsDirection === '0' ? 'AC/W' : 'C/W'
      }

      mappedDepartures.push({
        trip,
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime,
        destination: trip.destination,
        loopDirection,
        vehicleDescriptor,
        routeNumber,
        sortNumber,
        tram
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
}

async function getScheduledDepartures(stop, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'tram')

  return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'tram', 90, false)
}

async function getDepartures(stop, db) {
  let cacheKey = stop.stopName + 'T'

  if (ptvAPILocks[cacheKey]) {
    return await new Promise(resolve => {
      ptvAPILocks[cacheKey].on('done', data => {
        resolve(data)
      })
    })
  }

  if (departuresCache.get(cacheKey)) {
    return departuresCache.get(cacheKey)
  }

  ptvAPILocks[cacheKey] = new EventEmitter()

  function returnDepartures(departures) {
    ptvAPILocks[cacheKey].emit('done', departures)
    delete ptvAPILocks[cacheKey]

    return departures
  }

  let departures

  try {
    try {
      departures = await getDeparturesFromPTV(stop, db)
      departuresCache.put(cacheKey, departures)

      return returnDepartures(departures)
    } catch (e) {
      departures = (await getScheduledDepartures(stop, db, false)).map(departure => {
        departure.vehicleDescriptor = {}
        return departure
      })

      return returnDepartures(departures)
    }
  } catch (e) {
    return returnDepartures(null)
  }

  return departures
}

module.exports = getDepartures
