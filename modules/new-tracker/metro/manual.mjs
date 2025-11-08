import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { updateTDNFromPTV } from './metro-ptv-trips.mjs'
import { updateRelatedTrips } from './check-new-updates.mjs'
import fs from 'fs/promises'

export async function fetchTrips(db, tripDB, ptvAPI) {
  let updatedTDNs = process.argv.slice(2)
  let updatedTrips = []

  for (let updatedTDN of updatedTDNs) {
    updatedTrips.push(await updateTDNFromPTV(db, tripDB, updatedTDN, ptvAPI, {}, 'manual'))
  }

  return updatedTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDB = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  let updatedTrips = await fetchTrips(database, tripDB, ptvAPI)
  if (updatedTrips.length) global.loggers.trackers.metro.log('> Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))
  await updateRelatedTrips(database, tripDB, updatedTrips, ptvAPI)

  process.exit(0)
}