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

let tripLoader = {}
let tripCache = {}

async function getStoppingPatternWithCache(db, coachDeparture, destination) {
  let id = coachDeparture.scheduled_departure_utc + destination

  if (tripLoader[id]) {
    return await new Promise(resolve => tripLoader[id].on('loaded', resolve))
  } else if (!tripCache[id]) {
    tripLoader[id] = new EventEmitter()
    tripLoader[id].setMaxListeners(1000)

    let trip = await getStoppingPattern(db, coachDeparture.run_id, 'regional coach', coachDeparture.scheduled_departure_utc)

    tripCache[id] = trip
    tripLoader[id].emit('loaded', trip)
    delete tripLoader[id]

    return trip
  } else return tripCache[id]
}

function getAllStopGTFSIDs(stop) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach', false)
  let coachGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional train', false)
  return gtfsIDs.concat(coachGTFSIDs).filter((e, i, a) => a.indexOf(e) == i)
}

async function getDeparturesFromPTV(stop, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach', healthCheck.isOnline())
  let coachGTFSIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional train', healthCheck.isOnline())
  gtfsIDs = gtfsIDs.concat(coachGTFSIDs).filter((e, i, a) => a.indexOf(e) == i)
  let mappedDepartures = []
  let now = utils.now()

  let allGTFSIDs = getAllStopGTFSIDs(stop)

  await async.forEach(gtfsIDs, async stopGTFSID => {
    const {departures, runs} = await ptvAPI(`/v3/departures/route_type/3/stop/${stopGTFSID}?gtfs=true&max_results=5&expand=run`)
    let coachDepartures = departures.filter(departure => departure.flags.includes('VCH'))

    let seenIDs = []
    await async.forEach(coachDepartures, async coachDeparture => {
      if (seenIDs.includes(coachDeparture.run_id)) return
      seenIDs.push(coachDeparture.run_id)
      let run = runs[coachDeparture.run_id]

      let departureTime = moment.tz(coachDeparture.scheduled_departure_utc, 'Australia/Melbourne')
      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime)
      if (departureTime.diff(now, 'minutes') > 180) return

      let trip = await departureUtils.getDeparture(db, allGTFSIDs, scheduledDepartureTimeMinutes, run.destination_name, 'regional coach')
      if (!trip) trip = await getStoppingPatternWithCache(db, coachDeparture, run.destination_name)
      mappedDepartures.push({
        trip,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: scheduledDepartureTimeMinutes,
        destination: trip.destination
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length)
    .sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
}

async function getScheduledDepartures(stop, db, useLive) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'regional coach')

  return (await async.map(gtfsIDs, async gtfsID => {
    return await departureUtils.getScheduledDepartures(gtfsID, db, 'regional coach', 180, useLive)
  })).reduce((acc, departures) => {
    return acc.concat(departures)
  }, [])
}

async function getDepartures(stop, db) {
  if (departuresCache.get(stop.stopName + 'C')) return departuresCache.get(stop.stopName + 'C')

  let departures
  if (healthCheck.isOnline())
    departures = await getDeparturesFromPTV(stop, db)
  else
    departures = await getScheduledDepartures(stop, db, false)

  let coachOverrides = await getScheduledDepartures(stop, db, true)

  coachOverrides = coachOverrides.map(departure => {
    departure.isOverride = true
    return departure
  }).filter(departure => departure.trip.type === 'vline coach replacement')

  let mergedDepartures = departures.concat(coachOverrides).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
    .map(coach => { coach.coachCount = 1; return coach  })

  let serviceIDs = []
  let mergedCoachDepartures = {}

  mergedDepartures.forEach(departure => {
    let serviceID = departure.scheduledDepartureTime + departure.destination
    if (serviceIDs.includes(serviceID))
      mergedCoachDepartures[serviceID].coachCount++
    else {
      mergedCoachDepartures[serviceID] = departure
      serviceIDs.push(serviceID)
    }
  })

  departuresCache.put(stop.stopName + 'C', Object.values(mergedCoachDepartures))
  return Object.values(mergedCoachDepartures)
}

module.exports = getDepartures
