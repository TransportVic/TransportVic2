import { makePBRequest } from '../gtfsr/gtfsr-api.js'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import { getStopByName, updateTrip } from '../metro-trains/trip-updater.mjs'
import getMetroDepartures from '../metro-trains/get-departures.js'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../metro-trains/get-stopping-pattern.js'

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export async function getTrips(db, ptvAPI, station) {
  let departures = await getMetroDepartures(station, db)

  let importantDepartures = departures.filter(departure => !departure.isRailReplacementBus).slice(0, 5)
  let updates = []
  for (let departure of importantDepartures) {
    updates.push(await getTripUpdateData(departure.runID, ptvAPI))
  }

  return updates
}

export async function fetchTrips(db, ptvAPI) {
  let allStations = await db.getCollection('stops').findDocuments({
    'bays.mode': 'metro train'
  }).toArray()
  shuffleArray(allStations)
  let station = allStations[0]
  
  console.log('Loading next 5 departures from', station.stopName)

  let relevantTrips = await getTrips(db, ptvAPI, station)
  console.log('> Updating TDNs: ' + relevantTrips.map(trip => trip.runID).join(', '))

  for (let tripData of relevantTrips) {
    await updateTrip(db, tripData)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}