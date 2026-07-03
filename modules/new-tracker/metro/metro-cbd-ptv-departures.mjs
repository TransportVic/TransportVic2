import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips } from './metro-ptv-departures.mjs'
import { updateRelatedTrips } from './check-new-updates.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

async function fetchStop(name, db, tripDB, ptvAPI, maxResults, backwards, tdnsSeen, updatedTrips, existingTrips) {
  let newlyUpdatedTrips = await fetchTrips(db, tripDB, ptvAPI, {
    stationName: name,
    skipTDN: tdnsSeen,
    maxResults,
    backwards,
    existingTrips
  })

  let newTDNs = newlyUpdatedTrips.map(trip => trip.runID)
  tdnsSeen.push(...newTDNs)

  for (let trip of newlyUpdatedTrips) updatedTrips[trip.runID] = trip
  global.loggers.trackers.metro.log('> CBD Departures: Updating TDNs: ' + newTDNs.join(', '))
}

export async function fetchCBDTrips(db, tripDB, ptvAPI, existingTrips = {}) {
  let tdnsSeen = []
  let updatedTrips = {}

  let promises = []
  promises.push(fetchStop('Flinders Street Railway Station', db, tripDB, ptvAPI, 5, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Richmond Railway Station', db, tripDB, ptvAPI, 5, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Jolimont Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('North Melbourne Railway Station', db, tripDB, ptvAPI, 5, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Southern Cross Railway Station', db, tripDB, ptvAPI, 5, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Anzac Railway Station', db, tripDB, ptvAPI, 5, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Arden Railway Station', db, tripDB, ptvAPI, 5, false, tdnsSeen, updatedTrips, existingTrips))
  await Promise.all(promises)

  promises = []
  promises.push(fetchStop('Footscray Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Ringwood Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Dandenong Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Mordialloc Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Greensborough Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Broadmeadows Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Newport Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Watergardens Railway Station', db, tripDB, ptvAPI, 3, false, tdnsSeen, updatedTrips, existingTrips))
  await Promise.all(promises)

  promises = []
  promises.push(fetchStop('Richmond Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Jolimont Railway Station', db, tripDB, ptvAPI, 2, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('North Melbourne Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Southern Cross Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Anzac Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Arden Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  await Promise.all(promises)

  promises = []
  promises.push(fetchStop('Footscray Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Ringwood Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Dandenong Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Mordialloc Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Greensborough Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Broadmeadows Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Newport Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))
  promises.push(fetchStop('Watergardens Railway Station', db, tripDB, ptvAPI, 3, true, tdnsSeen, updatedTrips, existingTrips))

  await Promise.all(promises)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchCBDTrips(database, tripDatabase, ptvAPI)

  process.exit(0)
}