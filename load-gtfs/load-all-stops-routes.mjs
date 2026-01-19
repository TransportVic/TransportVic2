import { MongoDatabaseConnection, LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { RouteLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import { createRouteProcessor } from '../transportvic-data/gtfs/process.mjs'
import config from '../config.json' with { type: 'json' }
import loadStops from './loaders/load-stops.mjs'

const { GTFS_MODES } = GTFS_CONSTANTS

const selectedModes = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(GTFS_MODES)

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gtfsPath = path.join(__dirname, '..', 'gtfs', '{0}')

const routesFile = path.join(gtfsPath, 'routes.txt')
const agencyFile = path.join(gtfsPath, 'agency.txt')

const mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const mongoStops = await mongoDB.getCollection('gtfs-stops')
const mongoRoutes = await mongoDB.getCollection('gtfs-routes')

const database = new LokiDatabaseConnection('transportvic')
const stops = await database.createCollection('gtfs-stops')
const routes = await database.createCollection('gtfs-routes')

const globalStart = new Date()

console.log('Loading stops', globalStart)
const {
  nameOverridesCounter,
  uniqueNamesCounter,
  time
} = await loadStops(database, selectedModes)

console.log('Loaded stops, took', time, 'seconds')

console.log('Stop overrides', nameOverridesCounter)
console.log('Unique stops', uniqueNamesCounter)

const start = new Date()
console.log('Loading routes', start)

let routeIDMap = {}
const routeProcessors = await createRouteProcessor(database)

for (let i of selectedModes) {
  let mode = GTFS_MODES[i]

  try {
    let routeProcessor = routeProcessors[i]

    let routeLoader = new RouteLoader(routesFile.replace('{0}', i), agencyFile.replace('{0}', i), mode, database)
    await routeLoader.loadRoutes({
      processRoute: route => {
        route.routeGTFSID = route.routeGTFSID.replace(/-0+/, '-')
        return routeProcessor ? routeProcessor(route) : route
      }
    })

    routeIDMap = {
      ...routeIDMap,
      ...routeLoader.getRouteIDMap()
    }

    console.log('Loaded routes for', GTFS_MODES[i])
  } catch (e) {
    console.log('ERROR: Failed to load routes for', GTFS_MODES[i])
    console.log(e)
  }
}

console.log('Loaded routes, took', (new Date() - start) / 1000, 'seconds')

let transferStart = new Date()
console.log('\nTransferring to MongoDB now\n')

await mongoStops.deleteDocuments({})
await mongoRoutes.deleteDocuments({})

console.log('Deleted existing data, loading', new Date())

function cleanLokiAttributes(stop) {
  delete stop.meta
  delete stop.$loki
  delete stop._id

  return stop
}

let allStops = (await stops.findDocuments({}).toArray()).map(cleanLokiAttributes)
await mongoStops.createDocuments(allStops)

let allRoutes = (await routes.findDocuments({}).toArray()).map(cleanLokiAttributes)
await mongoRoutes.createDocuments(allRoutes)

await stops.deleteDocuments({})
await routes.deleteDocuments({})

console.log('Done transferring to MongoDB, took', (new Date() - transferStart) / 1000, 'seconds')
console.log('\nLoading stops and routes took', (new Date() - globalStart) / 1000, 'seconds overall')

await fs.writeFile(path.join(__dirname, 'routes.json'), JSON.stringify(routeIDMap))

process.exit(0)