import { MongoDatabaseConnection, LokiDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { StopsLoader, RouteLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import uniqueStops from '../transportvic-data/excel/stops/unique-stops.json' with { type: 'json' }
import nameOverrides from '../transportvic-data/excel/stops/name-overrides.json' with { type: 'json' }
import { createRouteProcessor, createStopProcessor } from '../transportvic-data/gtfs/process.mjs'
import config from '../config.json' with { type: 'json' }
import ptvStops from './ptv-stops.json' with { type: 'json' }
import turf from '@turf/turf'

import suburbsList from '../transportvic-data/gtfs/stop-suburbs.json' with { type: 'json' }

const { GTFS_MODES } = GTFS_CONSTANTS

let allModes = Object.keys(GTFS_MODES)
let selectedModes = process.argv.slice(2)
if (!selectedModes.length) selectedModes = allModes

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const suburbsVIC = JSON.parse(await fs.readFile(path.join(__dirname, '../transportvic-data/geospatial/suburb-boundaries/vic.geojson')))
const suburbsNSW = JSON.parse(await fs.readFile(path.join(__dirname, '../transportvic-data/geospatial/suburb-boundaries/nsw.geojson')))
const suburbsACT = JSON.parse(await fs.readFile(path.join(__dirname, '../transportvic-data/geospatial/suburb-boundaries/act.geojson')))
const suburbsSA = JSON.parse(await fs.readFile(path.join(__dirname, '../transportvic-data/geospatial/suburb-boundaries/sa.geojson')))

const suburbs = {
   type: 'FeatureCollection',
   features: [ ...suburbsVIC.features, ...suburbsNSW.features, ...suburbsACT.features, ...suburbsSA.features ]
}

const gtfsPath = path.join(__dirname, '..', 'gtfs', '{0}')

const stopsFile = path.join(gtfsPath, 'stops.txt')
const routesFile = path.join(gtfsPath, 'routes.txt')
const agencyFile = path.join(gtfsPath, 'agency.txt')

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let mongoStops = await mongoDB.getCollection('gtfs-stops')
let mongoRoutes = await mongoDB.getCollection('gtfs-routes')

let database = new LokiDatabaseConnection('transportvic')
let stops = await database.createCollection('gtfs-stops')
let routes = await database.createCollection('gtfs-routes')

let start = new Date()
console.log('Start loading stops and routes', start)

let routeIDMap = {}

let nameOverridesCounter = Object.keys(nameOverrides).reduce((acc, e) => {
  acc[e] = 0
  return acc
}, {})

let uniqueNamesCounter = uniqueStops.reduce((acc, e) => {
  acc[e] = 0
  return acc
}, {})

let routeProcessors = await createRouteProcessor()
let stopProcessors = await createStopProcessor()

for (let i of selectedModes) {
  let mode = GTFS_MODES[i]

  try {
    let suburbFile
    if (['2', '3', '4'].includes(i)) suburbFile = suburbsVIC
    else suburbFile = suburbs
    
    let stopProcessor = stopProcessors[i]
    let stopLoader = new StopsLoader(stopsFile.replace('{0}', i), suburbFile, mode, database, stop => {
      let ptvStop = ptvStops[stop.originalName]
      if (ptvStop && ptvStop.length === 1) {
        if (ptvStop[0].suburb.includes('(')) return ptvStop[0].suburb
      } else if (ptvStop) {
        let distances = ptvStop.map(ptvStop => ({
          ...ptvStop,
          distance: turf.distance(ptvStop.location, stop.location) * 1000
        }))
        let best = distances.sort((a, b) => a.distance - b.distance)[0]
        if (best.distance < 2) {
          return best.suburb
        }
      }

      return suburbsList[stop.stopGTFSID]
    })

    await stopLoader.loadStops({
      getMergeName: stop => {
        if (uniqueStops.includes(stop.fullStopName)) {
          uniqueNamesCounter[stop.fullStopName]++
          return stop.fullStopName
        }
      },
      processStop: stop => {
        let updatedName = nameOverrides[stop.fullStopName]
        if (updatedName) {
          nameOverridesCounter[stop.fullStopName]++
          stop.fullStopName = updatedName
        }

        return stopProcessor ? stopProcessor(stop) : stop
      }
    })

    console.log('Loaded stops for', mode)
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
    console.log('ERROR: Failed to load stops and routes for', GTFS_MODES[i])
    console.log(e)
  }
}
console.log('Stop overrides', nameOverridesCounter)
console.log('Unique stops', uniqueNamesCounter)

console.log('Stops & Routes done, took', (new Date() - start) / 1000, 'seconds')

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
console.log('\nLoading stops and routes took', (new Date() - start) / 1000, 'seconds overall')

await fs.writeFile(path.join(__dirname, 'routes.json'), JSON.stringify(routeIDMap))

process.exit(0)