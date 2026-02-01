import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { updateTDNFromPTV } from './metro-ptv-trips.mjs'
import utils from '../../../utils.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

export async function getOutdatedTrips(database) {
  let liveTimetables = await database.getCollection('live timetables')
  return (await liveTimetables.findDocuments({
    mode: 'metro train',
    operationDays: utils.getYYYYMMDDNow(),
    $and: [{
      stopTimings: {
        $elemMatch: {
          actualDepartureTimeMS: { // Trip ended at most 7min ago
            $gte: +utils.now().add(-7, 'minutes')
          }
        }
      },
    }, {
      stopTimings: {
        $elemMatch: {
          actualDepartureTimeMS: { // Trip starts in 15min time
            $lte: +utils.now().add(15, 'minutes')
          }
        }
      },
    }],
    lastUpdated: {
      $gte: +utils.now().add(-20, 'minutes'),
      $lte: +utils.now().add(-2, 'minutes')
    },
    isRailReplacementBus: false
  }, { runID: 1, routeName: 1, circular: 1, runID: 1 }).toArray()).filter(trip => {
    let { runID, routeName, circular } = trip
    if (runID[0] === '8') {
      if (runID[1] !== '5') return false
      return routeName !== 'Stony Point' && !circular
    }
    return true
  }).map(trip => trip.runID)
}

export async function fetchOutdatedTrips(db, tripDB, ptvAPI, existingTrips = {}) {
  let outdatedTDNs = await getOutdatedTrips(db)
  let updatedTrips = []

  for (let outdatedTDN of outdatedTDNs) {
    if (existingTrips[outdatedTDN]) continue

    let tripData = await updateTDNFromPTV(db, tripDB, outdatedTDN, ptvAPI, {}, 'outdated-trip-from-ptv', true, existingTrips)
    if (tripData) updatedTrips.push(tripData)
  }

  if (updatedTrips.length) global.loggers.trackers.metro.log('> Outdated Trips: Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))
  return updatedTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchOutdatedTrips(database, tripDatabase, ptvAPI)

  process.exit(0)
}