import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { RailGTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import { parseConsist } from '../../metro-trains/fleet-parser.js'
import metroConsists from '../../../additional-data/metro-tracker/metro-consists.json' with { type: 'json' }
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

export async function getFleetData(gtfsrAPI) {
  let tripData = await gtfsrAPI('metro/vehicle-positions')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = RailGTFSRTrip.parse(trip.vehicle.trip)

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

export async function fetchGTFSRFleet(db) {
  let relevantTrips = await getFleetData(makePBRequest)
  global.loggers.trackers.metro.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    await MetroTripUpdater.updateTrip(db, tripData, { dataSource: 'gtfsr-vehicle-update' })
  }
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchGTFSRFleet(mongoDB)

  process.exit(0)
}