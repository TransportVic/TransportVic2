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
  
  let trips = []
  let seen = new Set()

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
        stopSequence: stop.stop_sequence,
        cancelled: stop.schedule_relationship === 1
      }

      if (stop.arrival) tripStop.estimatedArrivalTime = new Date(stop.arrival.time * 1000)
      if (stop.departure) tripStop.estimatedDepartureTime = new Date(stop.departure.time * 1000)

      tripData.stops.push(tripStop)
    }

    if (!seen.has(tripData.runID)) {
      trips.push(tripData)
      seen.add(tripData.runID)
    }
  }

  return trips
}

export async function fetchGTFSRTrips(db, tripDB, existingTrips) {
  const trips = await getUpcomingTrips(makePBRequest)

  global.loggers.trackers.bus.debug('Fetching trip data from DB')
  const newRunIDs = trips.filter(trip => !existingTrips[BusTripUpdater.getTripCacheValue(trip)])
  const groupedRuns = newRunIDs.reduce((acc, trip) => {
    if (!acc[trip.operationDays]) acc[trip.operationDays] = []
    acc[trip.operationDays].push(trip)

    return acc
  }, {})

  const tripData = newRunIDs.length ? await db.getCollection('live timetables').findDocuments({
    mode: 'bus',
    $or: Object.keys(groupedRuns).map(operationDay => ({
      operationDays: operationDay,
      runID: { $in: groupedRuns[operationDay].map(run => run.runID) }
    }))
  }).toArray() : []

  for (let trip of tripData) existingTrips[BusTripUpdater.getTripCacheValue(trip)] = LiveTimetable.fromDatabase(trip)
  global.loggers.trackers.bus.debug('Fetched trip data from DB')

  global.loggers.trackers.bus.log('GTFSR Updater: Fetched', trips.length, 'trips')

  global.loggers.trackers.bus.debug('Updating trip data in memory')
  await async.forEachLimit(trips, 400, async tripUpdateData => {
    await BusTripUpdater.updateTrip(db, tripDB, tripUpdateData, {
      dataSource: 'gtfsr-trip-update',
      existingTrips,
      skipWrite: true,
      skipStopCancellation: true,
      propagateDelay: true
    })
  })
  global.loggers.trackers.bus.debug('Updated trip data in memory')

  return trips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  await fetchGTFSRTrips(database, tripDatabase, {})

  process.exit(0)
}