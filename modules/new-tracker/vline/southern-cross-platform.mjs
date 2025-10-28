import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../../utils.js'
import config from '../../../config.json' with { type: 'json' }
import { GetPlatformServicesAPI, PTVAPI, PTVAPIInterface, VLineAPIInterface } from '@transportme/ptv-api'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import VLineTripUpdater from '../../vline/trip-updater.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

export async function getPlatformUpdates(operationDay, database, ptvAPI) {
  let stops = await database.getCollection('stops')
  let sss = await stops.findDocument({ stopName: 'Southern Cross Railway Station' })
  let vlineBay = sss.bays.find(bay => bay.mode === GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain && bay.stopType === 'station')
  let arrivals = await ptvAPI.vline.getArrivals(vlineBay.vnetStationName, GetPlatformServicesAPI.UP, 30)
  let departures = await ptvAPI.vline.getDepartures(vlineBay.vnetStationName, GetPlatformServicesAPI.DOWN, 1440)

  let allTrips = [...arrivals, ...departures]

  let output = []
  for (let trip of allTrips) {
    let tripData = await VLineTripUpdater.getTrip(database, trip.tdn, operationDay)
    if (!tripData) {
      global.loggers.trackers.vline.log('Skipped unknown trip', trip)
      continue
    }

    let updateData = {
      operationDays: operationDay,
      runID: trip.tdn,
      stops: [{
        stopName: sss.stopName,
        platform: trip.platform
      }]
    }

    let tripSSSStop = tripData.stopTimings.find(stop => stop.stopName === 'Southern Cross Railway Station')
    if (tripSSSStop && tripSSSStop.platform && tripSSSStop.platform.match(/^1[56][AB]$/) && trip.platform.match(/^1[56]$/)) updateData.stops[0].platform = null

    if (trip.estArrivalTime) updateData.stops[0].estimatedArrivalTime = new Date(trip.estArrivalTime)
    output.push(updateData)
  }

  return output
}

export async function fetchSSSPlatforms(operationDay, database, ptvAPI) {
  let tripUpdates = await getPlatformUpdates(operationDay, database, ptvAPI)

  for (let update of tripUpdates) {
    await VLineTripUpdater.updateTrip(database, update, {
      skipStopCancellation: true,
      dataSource: 'vline-platform-arrivals-sss'
    })
  }

  return tripUpdates
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  let vlineAPIInterface = new VLineAPIInterface(config.vlineCallerID, config.vlineSignature)
  ptvAPI.addVLine(vlineAPIInterface)

  let updatedTrips = await fetchSSSPlatforms(utils.getPTYYYYMMDD(utils.now()), mongoDB, ptvAPI)
  global.loggers.trackers.vline.log('> SSS Platforms: Updated TDNs:', updatedTrips.map(trip => trip.runID).join(', '))

  await mongoDB.close()
  process.exit(0)
}
