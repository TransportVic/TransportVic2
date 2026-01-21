import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import getMetroDepartures from '../../metro-trains/get-departures.mjs'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../../metro-trains/get-stopping-pattern.mjs'
import utils from '../../../utils.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

const PTV_BAD_STOPS = [
  'Showgrounds', 'Flemington Racecourse'
].map(stop => stop + ' Railway Station')

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

export async function updateTDNFromPTV(db, tripDB, runID, ptvAPI, ptvAPIOptions, dataSource, skipWrite = false, existingTrips = {}) {
  let tripUpdate = await getTripUpdateData(runID, ptvAPI, ptvAPIOptions)
  if (!tripUpdate) return null

  return await MetroTripUpdater.updateTrip(db, tripDB, tripUpdate, {
    dataSource,
    ignoreMissingStops: PTV_BAD_STOPS,
    updateTime: new Date(),
    skipWrite,
    existingTrips,
    fullTrip: true
  })
}

export async function getTrips(db, tripDB, ptvAPI, station, skipTDN = [], existingTrips = {}) {
  let departures = await getMetroDepartures(station, db)

  let departureDay = utils.now().startOf('day')
  if (utils.now().get('hour') < 3) departureDay.add(-1, 'day')

  let trains = departures.filter(departure => !departure.isRailReplacementBus)
  let updates = []
  let successfulDepartures = 0
  for (let departure of trains) {
    if (skipTDN.includes(departure.runID)) continue

    let tripUpdate = await updateTDNFromPTV(db, tripDB, departure.runID, ptvAPI, { date: new Date(departureDay.toISOString()) }, 'ptv-pattern', true, existingTrips)
    if (tripUpdate) {
      updates.push(tripUpdate)
      if (++successfulDepartures === 5) break
    } else {
      global.loggers.trackers.metro.log('Failed to get trip data for TDN', departure.runID)
    }
  }

  return updates
}

export async function fetchTrips(db, tripDB, ptvAPI, existingTrips = {}) {
  let allStations = await db.getCollection('stops').findDocuments({
    'bays.mode': 'metro train'
  }).toArray()
  shuffleArray(allStations)
  let station = allStations[0]
  
  global.loggers.trackers.metro.log('Loading next 5 trips from', station.stopName)

  let updatedTrips = await getTrips(db, tripDB, ptvAPI, station, [], existingTrips)
  global.loggers.trackers.metro.log('> PTV Trips: Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))
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