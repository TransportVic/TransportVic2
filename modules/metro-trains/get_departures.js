const TimedCache = require('timed-cache')
const async = require('async')
const moment = require('moment')
require('moment-timezone')
const ptvAPI = require('../../ptv-api')

const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 })
const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

function getMinutesPastMidnight(time) {
  const startOfToday = time.clone().startOf('day')
  return time.diff(startOfToday, 'minutes')
}

async function getDepartures(station, db) {
  if (departuresCache.get(station.stopName)) {
    return departuresCache.get(station.stopName)
  }

  const timetables = db.getCollection('timetables')

  const now = moment().tz('Australia/Melbourne')
  const minutesPastMidnight = getMinutesPastMidnight(now)
  const today = daysOfWeek[now.day()]

  let transformedDepartures = []

  const metroPlatform = station.bays.filter(bay => bay.mode === 'metro train')[0]
  let {departures, runs} = await ptvAPI(`/v3/departures/route_type/0/stop/${metroPlatform.stopGTFSID}?gtfs=true&max_results=10&include_cancelled=true&expand=run`)

  await async.forEach(departures, async departure => {
    let run = runs[departure.run_id]

    let scheduledDepartureTime = moment(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? moment(departure.estimated_departure_utc) : null
    let platform = departure.platform_number

    if (!run.vehicle_descriptor) return // run too far away

    let runID = run.vehicle_descriptor.id
    let vehicle = run.vehicle_descriptor.description

    let trip = await timetables.findDocument({
      runID, operationDays: today, mode: "metro train"
    })

    if (!trip) return // footy too yay! when are we hooking it into GTFS data? probs never cos footy is over LOL
    let stopData = trip.stopTimings.filter(stop => stop.stopGTFSID === metroPlatform.stopGTFSID)[0]
    let offset = 0
    if (stopData.departureTimeMinutes < 180) { // train leaves < 3am
      offset = 1440 // add 1 day to departure time from today
    }

    trip.vehicle = vehicle
    transformedDepartures.push({
      trip, scheduledDepartureTime, estimatedDepartureTime, platform, stopData,
      departureTimeMinutes: getMinutesPastMidnight(scheduledDepartureTime) + offset,
      cancelled: run.status === 'cancelled'
    })
  })

  transformedDepartures = transformedDepartures.sort((a, b) => {
    return (a.estimatedDepartureTime || a.scheduledDepartureTime) - (b.estimatedDepartureTime || b.scheduledDepartureTime)
  })

  departuresCache.put(station.stopName, transformedDepartures)
  return transformedDepartures
}

module.exports = getDepartures
