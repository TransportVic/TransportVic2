import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { GTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'
import BusTripUpdater from '../../bus/trip-updater.mjs'
import async from 'async'

async function writeUpdatedTrips(db, updatedTrips) {
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

  if (tripBulkOperations.length) await db.getCollection('live timetables').bulkWrite(tripBulkOperations)
  if (consistBulkOperations.length) await db.getCollection(BusTripUpdater.getTrackerDB()).bulkWrite(consistBulkOperations)
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

  return Object.values(trips)
}

export async function fetchGTFSRFleet(db, existingTrips) {
  let relevantTrips = await getFleetData(db, makePBRequest)
  global.loggers.trackers.bus.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  await async.forEachLimit(relevantTrips, 400, async tripData => {
    await BusTripUpdater.updateTrip(db, tripData, {
      dataSource: 'gtfsr-vehicle-update',
      existingTrips,
      skipWrite: true
    })
  })

  await writeUpdatedTrips(db, Object.values(existingTrips))

  global.loggers.trackers.bus.log('GTFSR Updater: Updated', relevantTrips.length, 'trips')
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchGTFSRFleet(mongoDB)

  process.exit(0)
}