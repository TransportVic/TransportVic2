import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips } from './metro-ptv-departures.mjs'

async function fetchStop(name, db, ptvAPI, maxResults, backwards, tdnsSeen) {
  let updatedTrips = await fetchTrips(db, ptvAPI, { stationName: name, skipTDN: tdnsSeen, maxResults, backwards })
  tdnsSeen.push(...updatedTrips.map(trip => trip.runID))
}

export async function fetchCBDTrips(db, ptvAPI) {
  let tdnsSeen = []
  await fetchStop('Flinders Street Railway Station', db, ptvAPI, 10, false, tdnsSeen)
  await fetchStop('Richmond Railway Station', db, ptvAPI, 10, false, tdnsSeen)
  await fetchStop('Jolimont Railway Station', db, ptvAPI, 10, false, tdnsSeen)
  await fetchStop('North Melbourne Railway Station', db, ptvAPI, 10, false, tdnsSeen)

  await fetchStop('Richmond Railway Station', db, ptvAPI, 5, true, tdnsSeen)
  await fetchStop('Jolimont Railway Station', db, ptvAPI, 5, true, tdnsSeen)
  await fetchStop('North Melbourne Railway Station', db, ptvAPI, 5, true, tdnsSeen)
  
  console.log('> Updating TDNs: ' + tdnsSeen.join(', '))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchCBDTrips(mongoDB, ptvAPI)

  process.exit(0)
}