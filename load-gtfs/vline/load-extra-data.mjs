import { MongoDatabaseConnection, LokiDatabaseConnection } from '@transportme/database'
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

const suburbs = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/vic.geojson')))

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

class DirectStopsLoader extends StopsLoader {
  getStopsDB(db) {
    return db.getCollection('stops')
  }
}

let mongoStops = await mongoDB.getCollection('gtfs-stops')
let mongoRoutes = await mongoDB.getCollection('gtfs-routes')

let stopLoader = new DirectStopsLoader('', suburbs, TRANSIT_MODES.regionalTrain, mongoDB)
let reader = new GTFSStopsReader('', suburbs)

await stopLoader.loadStop(reader.processEntity({
  "stop_id": "vic:rail:BAT-V",
  "stop_name": "Ballarat Railway Station (Ballarat)",
  "stop_lat": "-37.55883224553218",
  "stop_lon": "143.8595041856118",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

process.exit(0)