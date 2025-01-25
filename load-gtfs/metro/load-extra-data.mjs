import { MongoDatabaseConnection, LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { StopsLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import config from '../../config.json' with { type: 'json' }

import MetroData from './metro-data.json' with { type: 'json' }
import GTFSStopsReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSStopsReader.mjs'
import MetroRouteLoader from './MetroRouteLoader.mjs'
import GTFSRouteReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSRouteReader.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const suburbs = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/data.geojson')))

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let mongoStops = await mongoDB.getCollection('stops')
let mongoRoutes = await mongoDB.getCollection('routes')

let stopLoader = new StopsLoader('', suburbs, TRANSIT_MODES.metroTrain, mongoDB)
let reader = new GTFSStopsReader('')

for (let stop of MetroData.stops) await stopLoader.loadStop(reader.processEntity(stop))

let routeLoader = new MetroRouteLoader(mongoDB)
let routeReader = new GTFSRouteReader('', TRANSIT_MODES.metroTrain)
await routeLoader.loadAgencies()

for (let route of MetroData.routes) await routeLoader.loadRoute(routeReader.processEntity(route))

process.exit(0)