import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { updateTrip } from '../../metro-trains/trip-updater.mjs'
import getMetroDepartures from '../../metro-trains/get-departures.js'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import utils from '../../../utils.js'

export async function getOutdatedTrips(database) {
  let liveTimetables = await database.getCollection('live timetables')
  return await liveTimetables.distinct('runID', {
    stopTimings: {
      $elemMatch: {
        actualDepartureTimeMS: {
          $gte: +utils.now().add(-15, 'minutes')
        }
      }
    },
    lastUpdated: {
      $lte: +utils.now().add(-5, 'minutes')
    }
  })
}

async function fetchTrips(database, ptvAPI) {

}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}