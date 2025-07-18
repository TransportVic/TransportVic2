import { makePBRequest } from '../../gtfsr/gtfsr-api.js'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { MetroGTFSRTrip } from '../GTFSRTrip.mjs'
import TripUpdater from '../../metro-trains/trip-updater.mjs'
import { parseConsist } from '../../metro-trains/fleet-parser.js'
import metroConsists from '../../../additional-data/metro-tracker/metro-consists.json' with { type: 'json' }

export async function getFleetData(gtfsrAPI) {
  let tripData = await gtfsrAPI('metrotrain-vehicleposition-updates')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = MetroGTFSRTrip.parse(trip.vehicle.trip)

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

export async function fetchTrips(db) {
  let relevantTrips = await getFleetData(makePBRequest)
  console.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    await TripUpdater.updateTrip(db, tripData, { dataSource: 'gtfsr-vehicle-update' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchTrips(mongoDB)

  process.exit(0)
}