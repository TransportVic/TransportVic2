import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import { updateTrip } from '../metro-trains/trip-updater.mjs'
import getMetroDepartures from '../metro-trains/get-departures.js'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../metro-trains/get-stopping-pattern.js'

export async function getTrips(db, ptvAPI, station) {
  let departures = await getMetroDepartures(station, db)

  let trains = departures.filter(departure => !departure.isRailReplacementBus)
  let updates = []
  let successfulDepartures = 0
  for (let departure of trains) {
    let tripUpdate = await getTripUpdateData(departure.runID, ptvAPI)
    if (tripUpdate) {
      updates.push(tripUpdate)
      if (++successfulDepartures === 5) break
    } else {
      console.log('Failed to get trip data for TDN', departure.runID)
    }
  }

  return updates
}

export async function getUpdatedTDNs(db) {
  return (await db.getCollection('metro notify').findDocuments({
    fromDate: {
      $gte: (+new Date() / 1000) - 5 * 60
    },
    runID: { $exists: true }
  }).toArray()).map(alert => alert.runID)
}

export async function fetchTrips(db, ptvAPI) {

  console.log(recentAlerts)

  // console.log('Loading next 5 trips from', station.stopName)

  // let relevantTrips = await getTrips(db, ptvAPI, station)
  // console.log('> Updating TDNs: ' + relevantTrips.map(trip => trip.runID).join(', '))

  // for (let tripData of relevantTrips) {
  //   await updateTrip(db, tripData)
  // }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}