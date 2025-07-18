import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import TripUpdater from '../../metro-trains/trip-updater.mjs'
import getMetroDepartures from '../../metro-trains/get-departures.js'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../../metro-trains/get-stopping-pattern.js'
import utils from '../../../utils.js'
import { updateRelatedTrips } from './check-new-updates.mjs'

const PTV_BAD_STOPS = [
  'Anzac', 'Town Hall', 'State Library', 'Parkville', 'Arden',
  'Showgrounds', 'Flemington Racecourse'
].map(stop => stop + ' Railway Station')

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export async function updateTDNFromPTV(db, runID, ptvAPI, ptvAPIOptions, dataSource, skipWrite = false) {
  let tripUpdate = await getTripUpdateData(runID, ptvAPI, ptvAPIOptions)
  if (!tripUpdate) return null

  return await TripUpdater.updateTrip(db, tripUpdate, { dataSource, ignoreMissingStops: PTV_BAD_STOPS, updateTime: new Date(), skipWrite })
}

export async function getTrips(db, ptvAPI, station, skipTDN = []) {
  let departures = await getMetroDepartures(station, db)

  let departureDay = utils.now().startOf('day')
  if (utils.now().get('hour') < 3) departureDay.add(-1, 'day')

  let trains = departures.filter(departure => !departure.isRailReplacementBus)
  let updates = []
  let successfulDepartures = 0
  for (let departure of trains) {
    if (skipTDN.includes(departure.runID)) continue

    let tripUpdate = await updateTDNFromPTV(db, departure.runID, ptvAPI, { date: new Date(departureDay.toISOString()) }, 'ptv-pattern')
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

  let updatedTrips = await getTrips(db, ptvAPI, station)
  console.log('> PTV Trips: Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))

  await updateRelatedTrips(db, updatedTrips, ptvAPI)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}