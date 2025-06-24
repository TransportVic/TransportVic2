import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips } from './metro-ptv-departures.mjs'

export async function fetchCBDTrips(db, ptvAPI) {
  let tdnsSeen = []
  tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: 'Flinders Street Railway Station', skipTDN: tdnsSeen, maxResults: 10 }))
  tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: 'Richmond Railway Station', skipTDN: tdnsSeen, maxResults: 10 }))
  tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: 'Jolimont Railway Station', skipTDN: tdnsSeen, maxResults: 10 }))
  tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: 'North Melbourne Railway Station', skipTDN: tdnsSeen, maxResults: 10 }))

  tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: 'Richmond Railway Station', skipTDN: tdnsSeen, maxResults: 5, backwards: true }))
  tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: 'Jolimont Railway Station', skipTDN: tdnsSeen, maxResults: 5, backwards: true }))
  tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: 'North Melbourne Railway Station', skipTDN: tdnsSeen, maxResults: 5, backwards: true }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchCBDTrips(mongoDB, ptvAPI)

  process.exit(0)
}