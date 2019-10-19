const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')
const moment = require('moment')
const TimedCache = require('timed-cache')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 5 })
const healthCheck = require('../health-check')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const getStoppingPattern = require('../utils/get-stopping-pattern')

async function getDeparturesFromPTV(station, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(station, 'regional coach', healthCheck.isOnline())
  let coachGTFSIDs = departureUtils.getUniqueGTFSIDs(station, 'regional train', healthCheck.isOnline())
  gtfsIDs = gtfsIDs.concat(coachGTFSIDs).filter((e, i, a) => a.indexOf(e) == i)
  let mappedDepartures = []
  let now = utils.now()

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

      let trip = await departureUtils.getDeparture(db, stopGTFSID, scheduledDepartureTimeMinutes, run.destination_name, 'regional coach')
      if (!trip) trip = await getStoppingPattern(db, coachDeparture.run_id, 'regional coach', coachDeparture.scheduled_departure_utc)
      mappedDepartures.push({
        trip,
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime: null,
        actualDepartureTime: scheduledDepartureTimeMinutes,
        destination: trip.destination
      })
    })
  })

  return mappedDepartures.sort((a, b) => a.destination.length - b.destination.length).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
}

async function getScheduledDepartures(station, db, useLive) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(station, 'regional coach')

  return (await async.map(gtfsIDs, async gtfsID => {
    return await departureUtils.getScheduledDepartures(gtfsID, db, 'regional coach', 180, useLive)
  })).reduce((acc, departures) => {
    return acc.concat(departures)
  }, [])
}

async function getDepartures(station, db) {
  let departures
  if (healthCheck.isOnline())
    departures = await getDeparturesFromPTV(station, db)
  else
    departures = await getScheduledDepartures(station, db, false)

  let coachOverrides = await getScheduledDepartures(station, db, true)

  coachOverrides = coachOverrides.map(trip => {
    trip.isOverride = true
    return trip
  }).filter(departure => departure.trip.type === 'vline coach replacement')

  return departures.concat(coachOverrides)
}

module.exports = getDepartures
