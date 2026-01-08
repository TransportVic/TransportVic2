import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'

import { TripLoader, ShapeLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import routeIDMap from './routes.json' with { type: 'json' }
import { createTripProcessor } from '../transportvic-data/gtfs/process.mjs'
import config from '../config.json' with { type: 'json' }
import { getVLineRuleStats } from '../transportvic-data/gtfs/processors/trip/5/1-remove-duplicates.mjs'

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

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let mongoStops = await mongoDB.getCollection('gtfs-stops')
let mongoRoutes = await mongoDB.getCollection('gtfs-routes')
let mongoTimetables = await mongoDB.getCollection('gtfs-gtfs timetables')

let start = new Date()
console.log('Start', start)

await mongoTimetables.deleteDocuments({})

console.log('Loading timetables now\n')

let tripsStart = new Date()

let directionIDMap = {}
let tripProcessors = await createTripProcessor(mongoDB)

tripProcessors[2] = trip => {
  trip.trueOrigin = trip.origin
  trip.trueDestination = trip.destination
  trip.trueDepartureTime = trip.departureTime
  trip.trueDestinationArrivalTime = trip.destinationArrivalTime

  return trip
}

let totalStopServiceTime = 0
let totalShapeTime = 0

for (let i of selectedModes) {
  let mode = GTFS_MODES[i]
  try {
    console.log('Loading trips for', mode)
    let tripLoader = new TripLoader({
      tripsFile: tripsFile.replace('{0}', i),
      stopTimesFile: stopTimesFile.replace('{0}', i),
      calendarFile: calendarFile.replace('{0}', i),
      calendarDatesFile: calendarDatesFile.replace('{0}', i)
    }, mode, mongoDB)

    await tripLoader.loadTrips({
      routeIDMap,
      processTrip: tripProcessors[i],
      onWrite: count => console.log(`Loaded ${count} trips for`, mode)
    })
    console.log('Loaded trips for', mode)

    directionIDMap = {
      ...directionIDMap,
      ...tripLoader.getDirectionIDMap()
    }

    let stopServiceStart = new Date()
    let stopServicesMap = tripLoader.getStopServicesMap()
    let bulkUpdate = Object.keys(stopServicesMap).map(stopGTFSID => ({
      updateOne: {
        filter: { bays: { $elemMatch: { stopGTFSID, mode } } },
        update: {
          $push: {
            'bays.$.services': { $each: stopServicesMap[stopGTFSID].services },
            'bays.$.screenServices': { $each: stopServicesMap[stopGTFSID].screenServices },
          }
        }
      }
    }))

    await mongoStops.bulkWrite(bulkUpdate)
    totalStopServiceTime += (new Date() - stopServiceStart)

    console.log('Loaded stop services for', mode)

    let shapeStart = new Date()
    console.log('Loading shapes for', GTFS_MODES[i])

    let shapeLoader = new ShapeLoader(shapeFile.replace('{0}', i), mongoDB)
    await shapeLoader.loadShapes({ shapeIDMap: tripLoader.getShapeIDMap() })

    console.log('Loaded shapes for', GTFS_MODES[i])
    totalShapeTime += (new Date() - shapeStart)
  } catch (e) {
    console.log('Failed to load trips for', mode)
    console.log(e)
  }
}

await fs.writeFile(path.join(__dirname, 'directions.json'), JSON.stringify(directionIDMap))

console.log('Trip exclusion stats', getVLineRuleStats())

console.log('Loading trips done, took', (new Date() - tripsStart) / 1000, 'seconds')
console.log('Loading stop services took', totalStopServiceTime / 1000, 'seconds')
console.log('\nLoading both trips and shapes took', (new Date() - start) / 1000, 'seconds overall')

process.exit(0)