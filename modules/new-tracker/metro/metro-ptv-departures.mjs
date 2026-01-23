import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../../metro-trains/get-ptv-departures.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export async function fetchTrips(db, tripDB, ptvAPI, {
  stationName = null,
  skipTDN = [],
  maxResults = 5,
  backwards = false,
  existingTrips = {}
} = {}) {
  let query = { 'bays.mode': 'metro train' }
  if (stationName) query.stopName = stationName
  let allStations = await db.getCollection('stops').findDocuments(query).toArray()
  shuffleArray(allStations)
  let station = allStations[0]

  global.loggers.trackers.metro.log(`Loading next ${maxResults} departures from`, station.stopName)

  let relevantTrips = await getTripUpdateData(db, station, ptvAPI, { skipTDN, maxResults, backwards })
  let updatedTrips = []

  for (let tripData of relevantTrips) {
    let { type, data } = tripData
    updatedTrips.push(await MetroTripUpdater.updateTrip(db, tripDB, data, {
      skipStopCancellation: type === 'stop',
      updatedTime: type === 'trip' ? new Date() : null,
      dataSource: 'ptv-departure',
      skipWrite: true,
      existingTrips,
      fullTrip: true,
      deconflictConsist: true
    }))
  }

  return updatedTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(database, tripDatabase, ptvAPI)

  process.exit(0)
}