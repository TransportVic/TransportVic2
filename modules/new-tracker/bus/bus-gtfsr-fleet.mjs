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
  const trips = await getFleetData(tripDB, makePBRequest)
  const relevantTrips = Object.values(trips)

  const newRunIDs = Object.keys(trips).filter(runID => !existingTrips[runID])
  const tripData = await db.getCollection('live timetables').findDocuments({
    mode: 'bus',
    $or: newRunIDs.map(runID => ({
      operationDays: trips[runID].operationDays,
      runID
    }))
  }).toArray()

  for (let trip of tripData) existingTrips[BusTripUpdater.getTripCacheValue(trip)] = LiveTimetable.fromDatabase(trip)

  global.loggers.trackers.bus.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  await async.forEachLimit(relevantTrips, 400, async tripUpdateData => {
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

  return relevantTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  await fetchGTFSRFleet(database, tripDatabase, {})

  process.exit(0)
}