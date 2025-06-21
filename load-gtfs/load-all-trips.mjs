import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import { TripLoader, ShapeLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import routeIDMap from './routes.json' with { type: 'json' }
import { createTripProcessor, getVLineRuleStats } from '../transportvic-data/gtfs/process.mjs'
import config from '../config.json' with { type: 'json' }

import fs from 'fs/promises'

const { GTFS_MODES } = GTFS_CONSTANTS

let allModes = Object.keys(GTFS_MODES)
let selectedModes = process.argv.slice(2)
if (!selectedModes.length) selectedModes = allModes

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gtfsPath = path.join(__dirname, '..', 'gtfs', '{0}')

const calendarFile = path.join(gtfsPath, 'calendar.txt')
const calendarDatesFile = path.join(gtfsPath, 'calendar_dates.txt')
const tripsFile = path.join(gtfsPath, 'trips.txt')
const stopTimesFile = path.join(gtfsPath, 'stop_times.txt')
const shapeFile = path.join(gtfsPath, 'shapes.txt')

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.gtfsDatabaseName)
await mongoDB.connect()

let mongoStops = await mongoDB.getCollection('stops')
let mongoRoutes = await mongoDB.getCollection('routes')
let mongoTimetables = await mongoDB.getCollection('gtfs timetables')

let start = new Date()
console.log('Start', start)

await mongoTimetables.deleteDocuments({})

console.log('Loading timetables now\n')

let tripsStart = new Date()

let shapeIDMap = {}
let directionIDMap = {}
let tripProcessors = await createTripProcessor(mongoDB)
let stopServicesMap = {}

tripProcessors[2] = trip => {
  trip.trueOrigin = trip.origin
  trip.trueDestination = trip.destination
  trip.trueDepartureTime = trip.departureTime
  trip.trueDestinationArrivalTime = trip.destinationArrivalTime

  return trip
}

for (let i of selectedModes) {
  try {
    console.log('Loading trips for', GTFS_MODES[i])
    let tripLoader = new TripLoader({
      tripsFile: tripsFile.replace('{0}', i),
      stopTimesFile: stopTimesFile.replace('{0}', i),
      calendarFile: calendarFile.replace('{0}', i),
      calendarDatesFile: calendarDatesFile.replace('{0}', i)
    }, GTFS_MODES[i], mongoDB)

    await tripLoader.loadTrips({
      routeIDMap,
      processTrip: tripProcessors[i]
    })
    console.log('Loaded trips for', GTFS_MODES[i])

    shapeIDMap = {
      ...shapeIDMap,
      ...tripLoader.getShapeIDMap()
    }

    directionIDMap = {
      ...directionIDMap,
      ...tripLoader.getDirectionIDMap()
    }
    
    let modeServiceMap = tripLoader.getStopServicesMap()
    for (let stopGTFSID of Object.keys(modeServiceMap)) {
      let stopData = modeServiceMap[stopGTFSID]
      if (!stopServicesMap[stopGTFSID]) stopServicesMap[stopGTFSID] = { services: [], screenServices: [] }
      stopServicesMap[stopGTFSID].services.push(stopData.services)
      stopServicesMap[stopGTFSID].screenServices.push(stopData.screenServices)
    }
  } catch (e) {
    console.log('Failed to load trips for', GTFS_MODES[i])
  }
}

await fs.writeFile(path.join(__dirname, 'directions.json'), JSON.stringify(directionIDMap))

console.log('Trip exclusion stats', getVLineRuleStats())

console.log('Loading trips done, took', (new Date() - tripsStart) / 1000, 'seconds')

let shapeStart = new Date()
console.log('Loading shapes')

for (let i of selectedModes) {
  console.log('Loading shapes for', GTFS_MODES[i])
  let shapeLoader = new ShapeLoader(shapeFile.replace('{0}', i), mongoDB)

  await shapeLoader.loadShapes({ shapeIDMap })
}

console.log('Loading shapes took', (new Date() - shapeStart) / 1000, 'seconds')

let stopServiceStart = new Date()
console.log('Loading stop services')
for (let stopGTFSID of Object.keys(stopServicesMap)) {
  await mongoStops.updateDocument({
    bays: {
      $elemMatch: { stopGTFSID }
    }
  }, {
    $set: {
      'bays.$.services': stopServicesMap[stopGTFSID].services,
      'bays.$.screenServices': stopServicesMap[stopGTFSID].screenServices,
    }
  })
}

console.log('Done loading stop services, took', (new Date() - stopServiceStart) / 1000, 'seconds')

console.log('\nLoading both trips and shapes took', (new Date() - start) / 1000, 'seconds overall')

process.exit(0)