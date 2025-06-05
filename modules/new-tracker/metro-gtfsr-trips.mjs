import { makePBRequest } from '../gtfsr/gtfsr-api.js'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import LiveTimetable from '../schema/live-timetable.js'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import { MetroGTFSRTrip } from './GTFSRTrip.mjs'
import { getStop } from './trip-updater.mjs'

export async function getUpcomingTrips(db, gtfsrAPI) {
  let tripData = await gtfsrAPI('metrotrain-tripupdates')

  let output = []

  for (let trip of tripData.entity) {
    let gtfsrTripData = MetroGTFSRTrip.parse(trip.trip_update.trip)
    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      stops: [],
      cancelled: gtfsrTripData.getScheduleRelationship() === MetroGTFSRTrip.SR_CANCELLED
    }

    for (let stop of trip.trip_update.stop_time_update) {
      let stopData = await getStop(db, stop.stop_id)
      let tripStop = {
        stopName: stopData.fullStopName,
        platform: stopData.platform || null,
        scheduledDepartureTime: null,
        cancelled: stop.schedule_relationship === 1
      }

      if (stop.arrival) tripStop.estimatedArrivalTime = new Date(stop.arrival.time * 1000)
      if (stop.departure) tripStop.estimatedDepartureTime = new Date(stop.departure.time * 1000)

      tripData.stops.push(tripStop)
    }
    output.push(tripData)
  }

  return output
}

async function getRoute(db, routeName) {
  let routes = db.getCollection('routes')
  let route = await routes.findDocument({
    routeName
  })

  return route
}

async function getTrip(liveTimetables, runID, date) {
  return await liveTimetables.findDocument({
    mode: 'metro train',
    runID,
    operationDays: date
  })
}

async function createTrip(trip, db) {
  let routeData = await getRoute(db, trip.routeName)

  let timetable = new LiveTimetable(
    'metro train',
    trip.operationalDate,
    trip.routeName,
    routeData.routeNumber,
    routeData.routeGTFSID,
    null,
    null
  )

  timetable.runID = trip.tdn
  timetable.direction = trip.tdn[3] % 2 === 0 ? 'Up' : 'Down'
  timetable.forming = trip.forming
  timetable.formedBy = trip.formedBy

  for (let stop of trip.stops) {
    let stopData = await getStop(db, stop.stationName + ' Railway Station')
    let platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.platform === stop.platform)

    timetable.updateStopByName(stopData.stopName, {
      stopGTFSID: platformBay.stopGTFSID,
      stopNumber: null,
      suburb: platformBay.suburb,
      scheduledDepartureTime: stop.scheduledDeparture.toUTC().toISO(),
      platform: stop.platform
    })
  }

  return timetable
}

export async function fetchTrips(db) {
  let relevantTrips = await getUpcomingTrips(db, makePBRequest)
  let liveTimetables = db.getCollection('live timetables')

  let tripObjects = {}
  utils.inspect(relevantTrips)
  // for (let trip of relevantTrips) {
  //   let tripData = await getTrip(liveTimetables, trip.tdn, trip.operationalDate)

  //   if (tripData) tripObjects[trip.tdn] = LiveTimetable.fromDatabase(tripData)
  //   else tripObjects[trip.tdn] = await createTrip(trip, db)
  // }

  // await liveTimetables.bulkWrite(bulkUpdate)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchTrips(mongoDB)

  process.exit(0)
}