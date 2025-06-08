import { makePBRequest } from '../gtfsr/gtfsr-api.js'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import LiveTimetable from '../schema/live-timetable.js'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import { MetroGTFSRTrip } from './GTFSRTrip.mjs'
import { getStop, updateTrip } from './trip-updater.mjs'

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

export async function fetchTrips(db) {
  let relevantTrips = await getUpcomingTrips(db, makePBRequest)

  for (let tripData of relevantTrips) {
    // TODO: Implement separate arrival/departure times
    let lastStop = tripData.stops[tripData.stops.length - 1]
    lastStop.estimatedDepartureTime = lastStop.estimatedArrivalTime
    await updateTrip(db, tripData)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchTrips(mongoDB)

  process.exit(0)
}