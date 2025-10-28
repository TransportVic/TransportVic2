import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { GTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import { parseConsist } from '../../metro-trains/fleet-parser.js'
import metroConsists from '../../../additional-data/metro-tracker/metro-consists.json' with { type: 'json' }
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

export async function getFleetData(gtfsrAPI) {
  let tripData = await gtfsrAPI('metro/vehicle-positions')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = GTFSRTrip.parse(trip.vehicle.trip)

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      consist: parseConsist(trip.vehicle.vehicle.id, metroConsists)
    }

    trips[tripData.runID] = tripData
  }

  return Object.values(trips)
}

export async function fetchGTFSRFleet(db, tripDB, existingTrips = {}) {
  let relevantTrips = await getFleetData(makePBRequest)
  global.loggers.trackers.metro.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    await MetroTripUpdater.updateTrip(db, tripDB, tripData, {
      dataSource: 'gtfsr-vehicle-update',
      existingTrips,
      skipWrite: true
    })
  }
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  await fetchGTFSRFleet(database, tripDatabase)

  process.exit(0)
}