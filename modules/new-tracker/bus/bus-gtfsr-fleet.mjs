import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { GTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'
import BusTripUpdater from '../../bus/trip-updater.mjs'
import async from 'async'

export async function getFleetData(gtfsrAPI) {
  let tripData = await gtfsrAPI('bus/vehicle-positions')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = GTFSRTrip.parse(trip.vehicle.trip)
    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      consist: [ trip.vehicle.vehicle.id ]
    }

    trips[tripData.runID] = tripData
  }

  return Object.values(trips)
}

export async function fetchGTFSRFleet(db) {
  let relevantTrips = await getFleetData(makePBRequest)
  global.loggers.trackers.bus.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  await async.forEachLimit(relevantTrips, 400, async tripData => {
    await BusTripUpdater.updateTrip(db, tripData, { dataSource: 'gtfsr-vehicle-update' })
  })

  global.loggers.trackers.bus.log('GTFSR Updater: Updated', relevantTrips.length, 'trips')
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchGTFSRFleet(mongoDB)

  process.exit(0)
}