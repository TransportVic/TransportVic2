import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { GTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import parseConsist from '../../vline/fleet-parser.mjs'
import _ from '../../../init-loggers.mjs'
import VLineTripUpdater from '../../vline/trip-updater.mjs'
import fs from 'fs/promises'

export async function getFleetData(gtfsrAPI) {
  let tripData = await gtfsrAPI('vline/vehicle-positions')

  let trips = {}

  for (let trip of tripData.entity.filter(trip => trip.vehicle && trip.vehicle.vehicle)) {
    let gtfsrTripData = GTFSRTrip.parse(trip.vehicle.trip)

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

export async function fetchGTFSRFleet(db, gtfsrAPI) {
  let relevantTrips = await getFleetData(gtfsrAPI)

  for (let tripData of relevantTrips) {
    await VLineTripUpdater.updateTrip(db, tripData, { dataSource: 'gtfsr-vehicle-update' })
  }

  return relevantTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchGTFSRFleet(mongoDB, makePBRequest)

  process.exit(0)
}