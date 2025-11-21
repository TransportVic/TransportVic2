import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import fs from 'fs/promises'
import { fetchGTFSRFleet } from './bus/bus-gtfsr-fleet.mjs'
import { isPrimary } from '../replication.mjs'
import discordIntegration from '../discord-integration.js'
import { hostname } from 'os'
import BusTripUpdater from '../bus/trip-updater.mjs'
import { fetchGTFSRTrips } from './bus/bus-gtfsr-trips.mjs'

async function writeUpdatedTrips(db, tripDB, updatedTrips) {
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

  let promises = []
  if (tripBulkOperations.length) promises.push(db.getCollection('live timetables').bulkWrite(tripBulkOperations, { ordered: false }))
  if (consistBulkOperations.length && await isPrimary()) promises.push(tripDB.getCollection(BusTripUpdater.getTrackerDB()).bulkWrite(consistBulkOperations, { ordered: false }))

  await Promise.all(promises)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `Bus Trip Updater: ${hostname()} loading`)

  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let existingTrips = {}

  await fetchGTFSRFleet(database, tripDatabase, existingTrips)
  // await fetchGTFSRTrips(database, tripDatabase, existingTrips)

  await writeUpdatedTrips(database, tripDatabase, Object.values(existingTrips))

  global.loggers.trackers.bus.log('GTFSR Updater: Updated', Object.values(existingTrips).length, 'trips')

  await discordIntegration('taskLogging', `Bus Trip Updater: ${hostname()} completed loading`)

  process.exit(0)
}