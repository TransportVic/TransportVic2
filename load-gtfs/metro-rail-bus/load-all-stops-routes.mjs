import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'

import config from '../../config.json' with { type: 'json' }
import operators from './operators.mjs'
import MTMRailStopLoader from './loaders/MTMRailStopLoader.mjs'
import MTMRailRouteLoader from './loaders/MTMRailRouteLoader.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
    let stopLoader = new MTMRailStopLoader(stopsFile, mongoDB)
    await stopLoader.loadStops()

    console.log('Loaded stops for', operator)

    let routeLoader = new MTMRailRouteLoader(routesFile, agencyFile, mongoDB)
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