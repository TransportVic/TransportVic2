import { MongoDatabaseConnection, LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { StopsLoader, RouteLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import config from '../config.json' with { type: 'json' }

import RCEStops from './extra-data/rce-stops.json' with { type: 'json' }
import GTFSStopsReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSStopsReader.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const suburbs = JSON.parse(await fs.readFile(path.join(__dirname, '../transportvic-data/geospatial/suburb-boundaries/data.geojson')))

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let mongoStops = await mongoDB.getCollection('stops')
let mongoRoutes = await mongoDB.getCollection('routes')

let metroLoader = new StopsLoader('', suburbs, TRANSIT_MODES.metroTrain, mongoDB)
let reader = new GTFSStopsReader('')

for (let stop of RCEStops) await metroLoader.loadStop(reader.processEntity(stop))
process.exit(0)