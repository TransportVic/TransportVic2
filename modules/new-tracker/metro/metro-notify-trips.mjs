import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { updateTrip } from '../../metro-trains/trip-updater.mjs'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../../metro-trains/get-stopping-pattern.js'

export async function getUpdatedTDNs(db) {
  return (await db.getCollection('metro notify').findDocuments({
    fromDate: {
      $gte: (+new Date() / 1000) - 5 * 60
    },
    runID: { $exists: true }
  }).toArray()).map(alert => alert.runID)
}

export async function fetchTrips(db, ptvAPI) {
  let updatedTDNs = await getUpdatedTDNs(db)
  for (let updatedTDN of updatedTDNs) {
    let tripData = await getTripUpdateData(updatedTDN, ptvAPI)
    await updateTrip(db, tripData, { dataSource: 'notify-trip-from-ptv' })
  }
  return updatedTDNs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  let updatedTDNs = await fetchTrips(mongoDB, ptvAPI)
  console.log('> Updating TDNs: ' + updatedTDNs.join(', '))

  process.exit(0)
}