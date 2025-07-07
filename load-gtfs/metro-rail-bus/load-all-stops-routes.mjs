import { MongoDatabaseConnection, LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { StopsLoader, RouteLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import config from '../../config.json' with { type: 'json' }
import operators from './operators.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const suburbsVIC = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/vic.geojson')))

const gtfsFolder = path.join(__dirname, '..', '..', 'gtfs', 'mtm-rail')

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()
let mongoRoutes = await mongoDB.getCollection('routes')

let start = new Date()
console.log('Start loading stops and routes', start)

await mongoRoutes.deleteDocument({ routeGTFSID: '2-RRB' })

let routeIDMap = {}

for (let operator of operators) {
  const operatorFolder = path.join(gtfsFolder, operator)
  const stopsFile = path.join(operatorFolder, 'stops.txt')
  const routesFile = path.join(operatorFolder, 'routes.txt')
  const agencyFile = path.join(operatorFolder, 'agency.txt')

  try {
    let stopLoader = new StopsLoader(stopsFile, suburbsVIC, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, mongoDB, null, 'stops')
    await stopLoader.loadStops({
      processStop: stop => {
        let parts
        if (parts = stop.fullStopName.match(/^([\w \.]*?)_?(Up|Down)$/i)) {
          stop.fullStopName = `${parts[1]} Railway Station`
          return stop
        } else if (parts = stop.originalName.match(/^([\w \.]+) \(([\w ]+)\)/)) {
          stop.fullStopName = `${parts[1]} Railway Station/${parts[2]}`
          return stop
        } else {
          stop.fullStopName = `${stop.fullStopName} Railway Station`
        }
        return stop
      }
    })

    console.log('Loaded stops for', operator)

    let routeLoader = new RouteLoader(routesFile, agencyFile, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, mongoDB, 'routes')
    await routeLoader.loadRoutes()

    routeIDMap = {
      ...routeIDMap,
      ...routeLoader.getRouteIDMap()
    }

    console.log('Loaded routes for', operator)
  } catch (e) {
    console.log('ERROR: Failed to load stops and routes for', operator)
    console.log(e)
  }
}

await fs.writeFile(path.join(__dirname, 'routes.json'), JSON.stringify(routeIDMap))

process.exit(0)