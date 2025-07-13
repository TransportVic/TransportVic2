import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { updateTDNFromPTV } from './metro-ptv-trips.mjs'
import utils from '../../../utils.js'

export async function getOutdatedTrips(database) {
  let liveTimetables = await database.getCollection('live timetables')
  return (await liveTimetables.distinct('runID', {
    $and: [{
      stopTimings: {
        $elemMatch: {
          actualDepartureTimeMS: { // Trip ended at most 15min ago
            $gte: +utils.now().add(-15, 'minutes')
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
      $lte: +utils.now().add(-5, 'minutes')
    }
  })).filter(tdn => tdn[0] !== '8')
}

async function fetchTrips(database, ptvAPI) {
  let outdatedTDNs = await getOutdatedTrips(database)
  let updatedTrips = []

  for (let outdatedTDN of outdatedTDNs) {
    updatedTrips.push(await updateTDNFromPTV(database, outdatedTDN, ptvAPI, {}, 'outdated-trip-from-ptv'))
  }

  return outdatedTDNs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}