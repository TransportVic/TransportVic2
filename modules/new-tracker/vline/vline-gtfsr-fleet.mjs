import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { RailGTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import parseConsist from '../../vline/fleet-parser.mjs'
import _ from '../../../init-loggers.mjs'
import VLineTripUpdater from '../../vline/trip-updater.mjs'

export async function getFleetData(gtfsrAPI) {
  let tripData = await gtfsrAPI('vline/vehicle-positions')

  let trips = {}

  for (let trip of tripData.entity.filter(trip => trip.vehicle && trip.vehicle.vehicle)) {
    let gtfsrTripData = RailGTFSRTrip.parse(trip.vehicle.trip)

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      consist: [ parseConsist(trip.vehicle.vehicle.id) ]
    }

    trips[tripData.runID] = tripData
  }

  return Object.values(trips)
}

export async function fetchGTFSRFleet(db) {
  let relevantTrips = await getFleetData(makePBRequest)
  global.loggers.trackers.metro.log('GTFSR Fleet Updater: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    await VLineTripUpdater.updateTrip(db, tripData, { dataSource: 'gtfsr-vehicle-update' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchGTFSRFleet(mongoDB)

  process.exit(0)
}