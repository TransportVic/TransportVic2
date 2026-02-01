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

export async function getFleetData(tripDB, gtfsrAPI) {
  let tripData = await gtfsrAPI('bus/vehicle-positions')
  let busRegos = tripDB.getCollection('bus regos')

  let trips = []

  const badRegos = (await busRegos.findDocuments({
    trackedRego: {
      $in: tripData.entity.map(trip => trip.vehicle.vehicle.id)
    }
  }).toArray()).reduce((acc, bus) => {
    acc[bus.trackedRego] = bus.rego
    return acc
  }, {})

  for (let trip of tripData.entity) {
    let gtfsrTripData = GTFSRTrip.parse(trip.vehicle.trip)
    const rego = badRegos[trip.vehicle.vehicle.id] || trip.vehicle.vehicle.id

    trips.push({
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      consist: [ rego ]
    })
  }

  return trips
}

export async function fetchGTFSRFleet(db, tripDB, existingTrips) {
  const trips = await getFleetData(tripDB, makePBRequest)

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
  }, { stopTimings: 0 }).toArray() : []

  for (let trip of tripData) existingTrips[BusTripUpdater.getTripCacheValue(trip)] = LiveTimetable.fromDatabase(trip)
  global.loggers.trackers.bus.debug('Fetched trip data from DB')

  global.loggers.trackers.bus.log('GTFSR Updater: Fetched', trips.length, 'trips')

  global.loggers.trackers.bus.debug('Updating fleet data in memory')
  await async.forEachLimit(trips, 400, async tripUpdateData => {
    try {
      await BusTripUpdater.updateTrip(db, tripDB, tripUpdateData, {
        dataSource: 'gtfsr-vehicle-update',
        existingTrips,
        skipWrite: true
      })
    } catch (e) {
      console.error('Error while updating trip', e)
    }
  })
  global.loggers.trackers.bus.debug('Updated fleet data in memory')

  return trips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  await fetchGTFSRFleet(database, tripDatabase, {})

  process.exit(0)
}