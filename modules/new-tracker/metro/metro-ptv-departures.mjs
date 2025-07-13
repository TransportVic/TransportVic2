import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { updateTrip } from '../../metro-trains/trip-updater.mjs'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../../metro-trains/get-ptv-departures.js'

const MTP_STOPS = [
  'Anzac', 'Town Hall', 'State Library', 'Parkville', 'Arden'
].map(stop => stop + ' Railway Station')

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export async function fetchTrips(db, ptvAPI, { stationName = null, skipTDN = [], maxResults = 5, backwards = false } = {}) {
  let query = { 'bays.mode': 'metro train' }
  if (stationName) query.stopName = stationName
  let allStations = await db.getCollection('stops').findDocuments(query).toArray()
  shuffleArray(allStations)
  let station = allStations[0]
  
  console.log(`Loading next ${maxResults} departures from`, station.stopName)

  let relevantTrips = await getTripUpdateData(db, station, ptvAPI, { skipTDN, maxResults, backwards })
  let updatedTDNs = relevantTrips.map(trip => trip.data.runID)
  console.log('> Updating TDNs: ' + updatedTDNs.join(', '))
  let updatedTrips = []
  
  for (let tripData of relevantTrips) {
    let { type, data } = tripData
    updatedTrips.push(await updateTrip(db, data, { skipStopCancellation: type === 'stop', dataSource: 'ptv-departure', ignoreMissingStops: MTP_STOPS }))
  }

  return updatedTDNs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}