import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { StopsLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import config from '../../config.json' with { type: 'json' }

import GTFSStopsReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSStopsReader.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const EasternStops = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/flexiride/eastern/stops.geojson')))
const MorningtonStops = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/flexiride/mornington/stops.geojson')))
const WoodendStops = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/flexiride/woodend/stops.geojson')))
const YarrawongaStops = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/flexiride/yarrawonga/stops.geojson')))
const suburbs = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/vic.geojson')))

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let stopLoader = new StopsLoader('', suburbs, TRANSIT_MODES.bus, mongoDB)
let reader = new GTFSStopsReader('', suburbs)

for (let stop of [...EasternStops.features, ...MorningtonStops.features, ...WoodendStops.features, ...YarrawongaStops.features]) {
  await stopLoader.loadStop(reader.processEntity({
    "stop_id": stop.properties.stopGTFSID,
    "stop_name": (stop.properties.stopNumber ? stop.properties.stopNumber + '-' : '' ) + stop.properties.stopName,
    "stop_lat": stop.geometry.coordinates[1],
    "stop_lon": stop.geometry.coordinates[0],
    "parent_station": "",
    "location_type": "1",
    "platform_code": ""
  }))
}

process.exit(0)