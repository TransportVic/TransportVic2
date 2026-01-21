import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import fs from 'fs/promises'
import { downloadData } from './download-data.mjs'
import { loadStopsRoutes } from './load-all-stops-routes.mjs'
import { loadTrips } from './load-all-trips.mjs'
import { loadHeadsigns } from './load-headsigns.mjs'
import utils from '../../utils.mjs'
import { loadOperationalTT } from './load-op-timetable.mjs'

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()
  
  await downloadData()
  const routeIDMap = await loadStopsRoutes(mongoDB)
  await loadTrips(mongoDB, routeIDMap)
  await loadHeadsigns(mongoDB)

  await loadOperationalTT(mongoDB, utils.now())
  await loadOperationalTT(mongoDB, utils.now().add(1, 'day'))

  process.exit(0)
}