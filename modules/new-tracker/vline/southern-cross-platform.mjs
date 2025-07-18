import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../../utils.js'
import config from '../../../config.json' with { type: 'json' }
import { GetPlatformServicesAPI, PTVAPI, PTVAPIInterface, VLineAPIInterface } from '@transportme/ptv-api'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import VLineTripUpdater from '../../vline/trip-updater.mjs'

export async function getPlatformUpdates(operationDay, database, ptvAPI) {
  let stops = await database.getCollection('stops')
  let sss = await stops.findDocument({ stopName: 'Southern Cross Railway Station' })
  let vlineBay = sss.bays.find(bay => bay.mode === GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain && bay.stopType === 'station')
  let departures = await ptvAPI.vline.getArrivals(vlineBay.vnetStationName, GetPlatformServicesAPI.UP, 30)

  let output = []
  for (let departure of departures) {
    let tripData = await VLineTripUpdater.getTrip(database, departure.tdn, operationDay)
    if (!tripData) {
      console.log('Skipped unknown trip', departure)
      continue
    }

    output.push({
      operationDays: operationDay,
      runID: departure.tdn,
      stops: [{
        stopName: sss.stopName,
        estimatedArrivalTime: new Date(departure.estArrivalTime),
        platform: departure.platform
      }]
    })
  }

  return output
}

export async function fetchTrips(operationDay, database, ptvAPI) {
  let tripUpdates = await getPlatformUpdates(operationDay, database, ptvAPI)

  for (let update of tripUpdates) {
    await VLineTripUpdater.updateTrip(database, update, {
      skipStopCancellation: true,
      dataSource: 'vline-platform-arrivals-sss'
    })
  }

  return tripUpdates
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  let vlineAPIInterface = new VLineAPIInterface(config.vlineCallerID, config.vlineSignature)
  ptvAPI.addVLine(vlineAPIInterface)

  let updatedTrips = await fetchTrips(utils.getYYYYMMDD(utils.now()), mongoDB, ptvAPI)
  console.log('> SSS Platforms: Updated TDNs:', updatedTrips.map(trip => trip.runID).join(', '))

  await mongoDB.close()
}
