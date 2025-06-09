import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import { updateTrip } from '../metro-trains/trip-updater.mjs'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../metro-trains/get-ptv-departures.js'

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export async function fetchTrips(db, ptvAPI) {
  let allStations = await db.getCollection('stops').findDocuments({
    'bays.mode': 'metro train',
    stopName: /Flinders Street/
  }).toArray()
  shuffleArray(allStations)
  let station = allStations[0]
  
  console.log('Loading next 5 departures from', station.stopName)

  let relevantTrips = await getTripUpdateData(db, station, ptvAPI)
  console.log('> Updating TDNs: ' + relevantTrips.map(trip => trip.runID).join(', '))

  for (let tripData of relevantTrips) {
    console.log(tripData)
    await updateTrip(db, tripData, { skipStopCancellation: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}