import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import { fetchGTFSRFleet } from './metro/metro-gtfsr-fleet.mjs'
import { fetchNotifyAlerts } from './metro/metro-notify.mjs'
import { fetchMetroSiteDepartures } from './metro/metro-trips-departures.mjs'
import { MetroSiteAPIInterface, PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips as fetchPTVDepartures } from './metro/metro-ptv-departures.mjs'
import { fetchTrips as fetchPTVTrips } from './metro/metro-ptv-trips.mjs'
import { fetchNotifyTrips } from './metro/metro-notify-trips.mjs'
import { fetchCBDTrips } from './metro/metro-cbd-ptv-departures.mjs'
import { fetchNotifySuspensions } from './metro/metro-notify-suspensions.mjs'
import { fetchOutdatedTrips } from './metro/metro-outdated-trips.mjs'
import { updateRelatedTrips } from './metro/check-new-updates.mjs'
import fs from 'fs/promises'
import MetroTripUpdater from '../metro-trains/trip-updater.mjs'
import { isPrimary } from '../replication.mjs'
import discordIntegration from '../discord-integration.js'
import { hostname } from 'os'

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

  if (tripBulkOperations.length) await db.getCollection('live timetables').bulkWrite(tripBulkOperations)
  if (consistBulkOperations.length) await tripDB.getCollection(MetroTripUpdater.getTrackerDB()).bulkWrite(consistBulkOperations)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url) && await isPrimary()) {
  await discordIntegration('taskLogging', `Metro Trip Updater: ${hostname()} loading`)

  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  let existingTrips = {}
  // await fetchGTFSRTrips(mongoDB)
  await fetchGTFSRFleet(database, tripDatabase, existingTrips)
  await fetchNotifyAlerts(database, ptvAPI)
  await fetchMetroSiteDepartures(database, tripDatabase, ptvAPI, existingTrips)

  let updatedTrips = await fetchPTVDepartures(database, tripDatabase, ptvAPI, { existingTrips })
  global.loggers.trackers.metro.log('> PTV Departures: Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))

  await fetchPTVTrips(database, tripDatabase, ptvAPI, existingTrips)
  await fetchNotifyTrips(database, tripDatabase, ptvAPI, existingTrips)
  await fetchCBDTrips(database, tripDatabase, ptvAPI, existingTrips)
  await fetchNotifySuspensions(database, tripDatabase, ptvAPI, existingTrips)
  await fetchOutdatedTrips(database, tripDatabase, ptvAPI, existingTrips)

  await writeUpdatedTrips(database, tripDatabase, Object.values(existingTrips))

  await updateRelatedTrips(database, tripDatabase, Object.values(existingTrips), ptvAPI)

  await discordIntegration('taskLogging', `Metro Trip Updater: ${hostname()} completed loading`)

  process.exit(0)
}