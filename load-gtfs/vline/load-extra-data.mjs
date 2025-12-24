import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { StopsLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import config from '../../config.json' with { type: 'json' }

import VLineData from '../../transportvic-data/gtfs/vline-data.mjs'
import GTFSStopsReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSStopsReader.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const suburbs = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/vic.geojson')))

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let stopLoader = new StopsLoader('', suburbs, TRANSIT_MODES.regionalTrain, mongoDB)
let reader = new GTFSStopsReader('', suburbs)

for (let stop of VLineData.stops) await stopLoader.loadStop(reader.processEntity(stop))

process.exit(0)