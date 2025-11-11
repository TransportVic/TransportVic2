import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import config from '../../../config.json' with { type: 'json' }

import GTFSRouteReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSRouteReader.mjs'
import MilduraRouteLoader from './MilduraRouteLoader.mjs'
import MilduraBusData from '../../../transportvic-data/gtfs/mildura-bus-data.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const dbRoutes = mongoDB.getCollection('gtfs-routes')
const conflictingRouteIDs = await dbRoutes.countDocuments({
  mode: 'bus',
  routeGTFSID: {
    $in: MilduraBusData.routes.map(r => r.route_id)
  }
})

if (conflictingRouteIDs !== 0) {
  console.error('Found conflicting route IDs, not applying fix')
  process.exit(0)
}

const routeLoader = new MilduraRouteLoader(mongoDB)
const routeReader = new GTFSRouteReader('', TRANSIT_MODES.bus)
routeLoader.loadAgencies()

for (const route of MilduraBusData.routes) await routeLoader.loadRoute(routeReader.processEntity(route))

process.exit(0)