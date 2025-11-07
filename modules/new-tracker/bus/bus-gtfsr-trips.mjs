import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { GTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'
import BusTripUpdater from '../../bus/trip-updater.mjs'
import async from 'async'
import { LiveTimetable } from '../../schema/live-timetable.mjs'

export async function getUpcomingTrips(gtfsrAPI) {
  let tripData = await gtfsrAPI('bus/trip-updates')
  
  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = GTFSRTrip.parse(trip.trip_update.trip)

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      stops: [],
      cancelled: gtfsrTripData.getScheduleRelationship() === GTFSRTrip.SR_CANCELLED,
      additional: gtfsrTripData.getScheduleRelationship() === GTFSRTrip.SR_ADDED,
      scheduledStartTime: gtfsrTripData.getStartTime()
    }

    for (let stop of trip.trip_update.stop_time_update) {
      let tripStop = {
        stopGTFSID: stop.stop_id,
        stopSequence: stop.stop_sequence
      }

      if (stop.schedule_relationship === 1) tripStop.cancelled = true
      if (stop.arrival) tripStop.estimatedArrivalTime = new Date(stop.arrival.time * 1000)
      if (stop.departure) tripStop.estimatedDepartureTime = new Date(stop.departure.time * 1000)

      tripData.stops.push(tripStop)
    }

    if (!trips[tripData.runID]) trips[tripData.runID] = tripData
  }

  return Object.values(trips)
}

export async function fetchGTFSRTrips(db, tripDB, existingTrips) {
  const trips = await getUpcomingTrips(makePBRequest)
  const relevantTrips = Object.values(trips)

  const newRunIDs = Object.keys(trips).filter(runID => !existingTrips[runID])
  const tripData = await db.getCollection('live timetables').findDocuments({
    mode: 'bus',
    $or: newRunIDs.map(runID => ({
      operationDays: trips[runID].operationDays,
      runID
    }))
  }).toArray()

  for (let trip of tripData) existingTrips[trip.runID] = LiveTimetable.fromDatabase(trip)

  global.loggers.trackers.bus.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  await async.forEachLimit(relevantTrips, 400, async tripUpdateData => {
    await BusTripUpdater.updateTrip(db, tripDB, tripUpdateData, {
      dataSource: 'gtfsr-trip-update',
      existingTrips,
      skipWrite: true,
      skipStopCancellation: true
    })
  })

  return relevantTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  await fetchGTFSRTrips(database, tripDatabase, {})

  process.exit(0)
}