import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { updateTrip } from '../../metro-trains/trip-updater.mjs'
import getMetroDepartures from '../../metro-trains/get-departures.js'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../../metro-trains/get-stopping-pattern.js'
import utils from '../../../utils.js'

const MTP_STOPS = [
  'Anzac', 'Town Hall', 'State Library', 'Parkville', 'Arden'
].map(stop => stop + ' Railway Station')

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export async function getTrips(db, ptvAPI, station) {
  let departures = await getMetroDepartures(station, db)

  let departureDay = utils.now().startOf('day')
  if (utils.now().get('hour') < 3) departureDay.add(-1, 'day')

  let trains = departures.filter(departure => !departure.isRailReplacementBus)
  let updates = []
  let successfulDepartures = 0
  for (let departure of trains) {
    let tripUpdate = await getTripUpdateData(departure.runID, ptvAPI, { date: new Date(departureDay.toISOString()) })
    if (tripUpdate) {
      updates.push(tripUpdate)
      if (++successfulDepartures === 5) break
    } else {
      console.log('Failed to get trip data for TDN', departure.runID)
    }
  }

  return updates
}

export async function fetchTrips(db, ptvAPI) {
  let allStations = await db.getCollection('stops').findDocuments({
    'bays.mode': 'metro train'
  }).toArray()
  shuffleArray(allStations)
  let station = allStations[0]
  
  console.log('Loading next 5 trips from', station.stopName)

  let relevantTrips = await getTrips(db, ptvAPI, station)
  console.log('> Updating TDNs: ' + relevantTrips.map(trip => trip.runID).join(', '))

  for (let tripData of relevantTrips) {
    await updateTrip(db, tripData, { dataSource: 'ptv-pattern', ignoreMissingStops: MTP_STOPS })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}