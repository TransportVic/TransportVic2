import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips } from './metro-ptv-departures.mjs'
import { updateRelatedTrips } from './check-new-updates.mjs'
import _ from '../../../init-loggers.mjs'

async function fetchStop(name, db, ptvAPI, maxResults, backwards, tdnsSeen, updatedTrips) {
  let newlyUpdatedTrips = await fetchTrips(db, ptvAPI, { stationName: name, skipTDN: tdnsSeen, maxResults, backwards })
  let newTDNs = newlyUpdatedTrips.map(trip => trip.runID)
  tdnsSeen.push(...newTDNs)

  for (let trip of newlyUpdatedTrips) updatedTrips[trip.runID] = trip
  global.loggers.trackers.metro.log('> CBD Departures: Updating TDNs: ' + newTDNs.join(', '))
}

export async function fetchCBDTrips(db, ptvAPI) {
  let tdnsSeen = []
  let updatedTrips = {}
  await fetchStop('Flinders Street Railway Station', db, ptvAPI, 10, false, tdnsSeen, updatedTrips)
  await fetchStop('Richmond Railway Station', db, ptvAPI, 10, false, tdnsSeen, updatedTrips)
  await fetchStop('Jolimont Railway Station', db, ptvAPI, 10, false, tdnsSeen, updatedTrips)
  await fetchStop('North Melbourne Railway Station', db, ptvAPI, 10, false, tdnsSeen, updatedTrips)

  await fetchStop('Richmond Railway Station', db, ptvAPI, 5, true, tdnsSeen, updatedTrips)
  await fetchStop('Jolimont Railway Station', db, ptvAPI, 5, true, tdnsSeen, updatedTrips)
  await fetchStop('North Melbourne Railway Station', db, ptvAPI, 5, true, tdnsSeen, updatedTrips)

  await updateRelatedTrips(db, Object.values(updatedTrips), ptvAPI)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchCBDTrips(mongoDB, ptvAPI)

  process.exit(0)
}