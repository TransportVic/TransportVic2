import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import fs from 'fs/promises'
import { isPrimary } from '../replication.mjs'
import discordIntegration from '../discord-integration.mjs'
import { hostname } from 'os'
import VLineTripUpdater from '../vline/trip-updater.mjs'
import { PTVAPI, PTVAPIInterface, VLineAPIInterface } from '@transportme/ptv-api'
import { makePBRequest } from '../gtfsr/gtfsr-api.mjs'
import { fetchSSSPlatforms } from './vline/southern-cross-platform.mjs'
import { fetchGTFSRTrips } from './vline/vline-gtfsr-trips.mjs'
import { fetchGTFSRFleet } from './vline/vline-gtfsr-fleet.mjs'
import utils from '../../utils.mjs'

async function writeUpdatedTrips(db, tripDB, updatedTrips) {
  const tripBulkOperations = updatedTrips.map(timetable => (timetable.stops.length ? {
    replaceOne: {
      filter: timetable.getDBKey(),
      replacement: timetable.toDatabase(),
      upsert: true
    }
  } : {
    updateOne: {
      filter: timetable.getDBKey(),
      update: {
        $set: (tt => ({
          vehicle: tt.vehicle,
          changes: tt.changes,
          lastUpdated: tt.lastUpdated
        }))(timetable.toDatabase())
      }
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
  if (consistBulkOperations.length && await isPrimary()) await tripDB.getCollection(VLineTripUpdater.getTrackerDB()).bulkWrite(consistBulkOperations)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `V/Line Trip Updater: ${hostname()} loading`)

  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  let vlineAPIInterface = new VLineAPIInterface(config.vlineCallerID, config.vlineSignature)
  ptvAPI.addVLine(vlineAPIInterface)

  let existingTrips = {}

  let sssTrips = await fetchSSSPlatforms(utils.getPTYYYYMMDD(utils.now()), database, tripDatabase, ptvAPI, existingTrips)
  global.loggers.trackers.vline.log('> SSS Platforms: Updated TDNs:', sssTrips.map(trip => trip.runID).join(', '))

  global.loggers.trackers.vline.log('V/Line GTFSR Updater: Loading trips')
  let gtfsTripTrips = await fetchGTFSRTrips(database, tripDatabase, makePBRequest, existingTrips)
  global.loggers.trackers.vline.log('V/Line GTFSR Updater: Updated TDNs:', gtfsTripTrips.map(trip => trip.runID).join(', '))

  global.loggers.trackers.metro.log('GTFSR Fleet Updater: Loading trips')
  let gtfsFleetTrips = await fetchGTFSRFleet(database, tripDatabase, makePBRequest, existingTrips)
  global.loggers.trackers.metro.log('GTFSR Fleet Updater: Fetched', gtfsFleetTrips.length, 'trips')

  await writeUpdatedTrips(database, tripDatabase, Object.values(existingTrips))

  await discordIntegration('taskLogging', `V/Line Trip Updater: ${hostname()} completed loading`)

  process.exit(0)
}