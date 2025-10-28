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

async function writeUpdatedTrips(db, tripDB, updatedTrips) {
  const tripBulkOperations = updatedTrips.map(timetable => ({
    replaceOne: {
      filter: timetable.getDBKey(),
      replacement: timetable.toDatabase(),
      upsert: true
    }
  }))

  const consistBulkOperations = updatedTrips.map(timetable => ({
    replaceOne: {
      filter: timetable.getTrackerDatabaseKey(),
      replacement: timetable.toTrackerDatabase(),
      upsert: true
    }
  })).filter(op => !!op.replaceOne.filter)

  let promises = []
  if (tripBulkOperations.length) promises.push(db.getCollection('live timetables').bulkWrite(tripBulkOperations, { ordered: false }))
  if (consistBulkOperations.length) promises.push(tripDB.getCollection(BusTripUpdater.getTrackerDB()).bulkWrite(consistBulkOperations, { ordered: false }))

  await Promise.all(promises)
}

export async function getFleetData(db, gtfsrAPI) {
  let tripData = await gtfsrAPI('bus/vehicle-positions')
  let busRegos = db.getCollection('bus regos')

  let trips = {}

  let regosSeen = {}
  let goodRegos = new Set()

  for (let trip of tripData.entity) {
    let gtfsrTripData = GTFSRTrip.parse(trip.vehicle.trip)
    const trackedRego = trip.vehicle.vehicle.id
    let trueRego = trackedRego

    if (!goodRegos.has(trackedRego)) {
      const busData = regosSeen[trackedRego] || await busRegos.findDocument({ trackedRego })
      if (busData) {
        regosSeen[trackedRego] = busData
        trueRego = busData.rego
      } else {
        goodRegos.add(trackedRego)
      }
    }

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      consist: [ trueRego ]
    }

    trips[tripData.runID] = tripData
  }

  return trips
}

export async function fetchGTFSRFleet(db, tripDB, existingTrips) {
  const trips = await getFleetData(db, makePBRequest)
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

  await async.forEachLimit(relevantTrips, 400, async tripData => {
    await BusTripUpdater.updateTrip(db, tripDB, tripData, {
      dataSource: 'gtfsr-vehicle-update',
      existingTrips,
      skipWrite: true
    })
  })

  await writeUpdatedTrips(db, tripDB, Object.values(existingTrips))

  global.loggers.trackers.bus.log('GTFSR Updater: Updated', relevantTrips.length, 'trips')
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  await fetchGTFSRFleet(database, tripDatabase)

  process.exit(0)
}