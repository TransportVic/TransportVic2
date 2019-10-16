const async = require('async')
const moment = require('moment')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')

let modes = {
  'metro train': 0
}

module.exports = async function (db, ptvRunID, mode, time) {
  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/${modes[mode]}?expand=stop&expand=run&expand=route`
  if (time)
    url += `&date_utc=${time}`

  let {departures, stops, runs, routes} = await ptvAPI(url)
  let run = Object.values(runs)[0]

  departures = departures.map(departure => {
    departure.actualDepartureTime = moment.tz(departure.estimated_departure_utc || departure.scheduled_departure_utc, 'Australia/Melbourne')
    departure.scheduledDepartureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
    departure.estimatedDepartureTime = moment.tz(departure.estimated_departure_utc, 'Australia/Melbourne')
    return departure
  }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  let dbStops = {}

  await async.forEach(Object.values(stops), async stop => {
    let dbStop = await stopsCollection.findDocument({
      stopName: stop.stop_name.trim() + ' Railway Station',
      'bays.mode': mode
    })
    dbStops[stop.stop_id] = dbStop
  })

  let stopTimings = departures.map((departure, i) => {
    let {
      estimatedDepartureTime, scheduledDepartureTime,
      stop_id, platform_number} = departure

    let stopBay = dbStops[stop_id].bays
      .filter(bay => bay.mode === mode)[0] // TODO: properly pick out the stop GTFS ID

    let departureTimeMinutes = utils.getPTMinutesPastMidnight(scheduledDepartureTime)

    let stopTiming = {
      stopName: stopBay.fullStopName,
      stopGTFSID: stopBay.stopGTFSID,
      arrivalTime: scheduledDepartureTime.format("HH:mm"),
      arrivalTimeMinutes: departureTimeMinutes,
      departureTime: scheduledDepartureTime.format("HH:mm"),
      departureTimeMinutes: departureTimeMinutes,
      estimatedDepartureTime: departure.estimated_departure_utc ? estimatedDepartureTime.toISOString() : null,
      platform: platform_number,
      stopConditions: ""
    }

    if (i == 0) {
      stopTiming.arrivalTime = null
      stopTiming.arrivalTimeMinutes = null
    } else if (i == departures.length - 1) {
      stopTiming.departureTime = null
      stopTiming.departureTimeMinutes = null
    }

    return stopTiming
  })

  let routeData = Object.values(routes)[0]

  let vehicleDescriptor = run.vehicle_descriptor || {}

  let timetable = {
    mode, routeName: routeData.route_name.trim(),
    runID: vehicleDescriptor.id,
    operationDay: utils.getYYYYMMDDNow(),
    vehicle: vehicleDescriptor.description,
    stopTimings: stopTimings.sort((a, b) => (a.arrivalTimeMinutes || a.departureTimeMinutes) - (b.arrivalTimeMinutes || b.departureTimeMinutes)),
    destination: stopTimings[stopTimings.length - 1].stopName,
    destinationArrivalTime: stopTimings[stopTimings.length - 1].arrivalTime,
    departureTime: stopTimings[0].departureTime,
    origin: stopTimings[0].stopName,
    type: "timings"
  }

  let key = {
    mode, routeName: timetable.routeName,
    operationDay: timetable.operationDay,
    runID: timetable.runID
  }

  await liveTimetables.replaceDocument(key, timetable, {
    upsert: true
  })

  timetable.destination = timetable.destination.slice(0, -16)
  timetable.origin = timetable.origin.slice(0, -16)

  return timetable
}
