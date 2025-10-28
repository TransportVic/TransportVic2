import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import fs from 'fs/promises'
import { isPrimary } from '../replication.mjs'
import discordIntegration from '../discord-integration.js'
import { hostname } from 'os'
import VLineTripUpdater from '../vline/trip-updater.mjs'
import { PTVAPI, PTVAPIInterface, VLineAPIInterface } from '@transportme/ptv-api'
import { makePBRequest } from '../gtfsr/gtfsr-api.mjs'
import { fetchSSSPlatforms } from './vline/southern-cross-platform.mjs'
import { fetchGTFSRTrips } from './vline/vline-gtfsr-trips.mjs'
import { fetchGTFSRFleet } from './vline/vline-gtfsr-fleet.mjs'
import utils from '../../utils.js'

async function writeUpdatedTrips(db, updatedTrips) {
  const tripBulkOperations = updatedTrips.map(timetable => ({
    replaceOne: {
      filter: timetable.getDBKey(),
      replacement: timetable.toDatabase(),
      upsert: true
    }
  }))

  const consistBulkOperations = updatedTrips.map(timetable => ({
    replaceOne: {
      filter: timetable.getTrackerDatabaseKey(),
      replacement: timetable.toTrackerDatabase(),
      upsert: true
    }
  })).filter(op => !!op.replaceOne.filter)

  if (tripBulkOperations.length) await db.getCollection('live timetables').bulkWrite(tripBulkOperations)
  if (consistBulkOperations.length) await db.getCollection(VLineTripUpdater.getTrackerDB()).bulkWrite(consistBulkOperations)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url) && await isPrimary()) {
  await discordIntegration('taskLogging', `V/Line Trip Updater: ${hostname()} loading`)

  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  let vlineAPIInterface = new VLineAPIInterface(config.vlineCallerID, config.vlineSignature)
  ptvAPI.addVLine(vlineAPIInterface)

  let sssTrips = await fetchSSSPlatforms(utils.getPTYYYYMMDD(utils.now()), mongoDB, ptvAPI)
  global.loggers.trackers.vline.log('> SSS Platforms: Updated TDNs:', sssTrips.map(trip => trip.runID).join(', '))

  global.loggers.trackers.vline.log('V/Line GTFSR Updater: Loading trips')
  let gtfsTripTrips = await fetchGTFSRTrips(mongoDB, makePBRequest)
  global.loggers.trackers.vline.log('V/Line GTFSR Updater: Updated TDNs:', gtfsTripTrips.map(trip => trip.runID).join(', '))

  global.loggers.trackers.metro.log('GTFSR Fleet Updater: Loading trips')
  let gtfsFleeTtrips = await fetchGTFSRFleet(mongoDB, makePBRequest)
  global.loggers.trackers.metro.log('GTFSR Fleet Updater: Fetched', gtfsFleeTtrips.length, 'trips')

  await discordIntegration('taskLogging', `V/Line Trip Updater: ${hostname()} completed loading`)

  process.exit(0)
}