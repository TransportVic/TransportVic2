import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import fs from 'fs/promises'
import { hostname } from 'os'
import { isPrimary } from '../../modules/replication.mjs'
import discordIntegration from '../../modules/discord-integration.js'
import { downloadData } from './download-data.mjs'
import { loadStopsRoutes } from './load-all-stops-routes.mjs'
import { loadTrips } from './load-all-trips.mjs'
import { loadHeadsigns } from './load-headsigns.mjs'
import utils from '../../utils.js'
import { loadOperationalTT } from './load-op-timetable.mjs'

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url) && await isPrimary()) {
  await discordIntegration('taskLogging', `Metro RRB GTFS: ${hostname()} loading`)

  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()
  
  await downloadData()
  await loadStopsRoutes(mongoDB)
  await loadTrips(mongoDB)
  await loadHeadsigns(mongoDB)

  await loadOperationalTT(mongoDB, utils.now())
  await loadOperationalTT(mongoDB, utils.now().add(1, 'day'))

  await discordIntegration('taskLogging', `Metro RRB GTFS: ${hostname()} completed loading`)

  process.exit(0)
}