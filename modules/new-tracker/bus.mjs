import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import fs from 'fs/promises'
import { fetchGTFSRFleet } from './bus/bus-gtfsr-fleet.mjs'
import { isPrimary } from '../replication.mjs'
import discordIntegration from '../discord-integration.js'
import { hostname } from 'os'

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url) && await isPrimary()) {
  await discordIntegration('taskLogging', `Bus Trip Updater: ${hostname()} loading`)

  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let existingTrips = {}

  await fetchGTFSRFleet(database, tripDatabase, existingTrips)

  await discordIntegration('taskLogging', `Bus Trip Updater: ${hostname()} completed loading`)

  process.exit(0)
}