import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { updateTDNFromPTV } from './metro-ptv-trips.mjs'
import { updateRelatedTrips } from './check-new-updates.mjs'

export async function fetchTrips(db, ptvAPI) {
  let updatedTDNs = process.argv.slice(2)
  let updatedTrips = []

  for (let updatedTDN of updatedTDNs) {
    updatedTrips.push(await updateTDNFromPTV(db, updatedTDN, ptvAPI, {}, 'manual'))
  }

  return updatedTrips
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  let updatedTrips = await fetchTrips(mongoDB, ptvAPI)
  if (updatedTrips.length) console.log('> Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))
  await updateRelatedTrips(mongoDB, updatedTrips, ptvAPI)

  process.exit(0)
}