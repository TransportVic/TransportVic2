import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import routeIDMap from './routes.json' with { type: 'json' }
import config from '../../config.json' with { type: 'json' }
import operators from './operators.mjs'

import fs from 'fs/promises'
import MTMRailTripLoader, { MTMTripReader } from './loaders/MTMRailTripLoader.mjs'
import MTMRailShapeLoader from './loaders/MTMRailShapeLoader.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const gtfsFolder = path.join(__dirname, '..', '..', 'gtfs', 'mtm-rail')

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let mongoStops = await mongoDB.getCollection('stops')
let mongoTimetables = await mongoDB.getCollection('gtfs timetables')

let start = new Date()
console.log('Start', start)

console.log('Loading timetables now\n')

let tripsStart = new Date()

let shapeIDMap = {}
let directionIDMap = {}
let errored = false

for (let operator of operators) {
  const operatorFolder = path.join(gtfsFolder, operator)
  const calendarFile = path.join(operatorFolder, 'calendar.txt')
  const tripsFile = path.join(operatorFolder, 'trips.txt')
  const stopTimesFile = path.join(operatorFolder, 'stop_times.txt')

  try {
    console.log('Loading trips for', operator)
    let tripLoader = new MTMRailTripLoader({
      tripsFile: tripsFile,
      stopTimesFile: stopTimesFile,
      calendarFile: calendarFile,
    }, mongoDB)

    await tripLoader.loadTrips(routeIDMap)

    console.log('Loaded trips for', operator)

    shapeIDMap = {
      ...shapeIDMap,
      ...tripLoader.getShapeIDMap()
    }

    directionIDMap = {
      ...directionIDMap,
      ...tripLoader.getDirectionIDMap()
    }

    let stopServicesMap = tripLoader.getStopServicesMap()
    let bulkUpdate = Object.keys(stopServicesMap).map(stopGTFSID => ({
      updateOne: {
        filter: { bays: { $elemMatch: { stopGTFSID, mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain } } },
        update: {
          $push: {
            'bays.$.services': { $each: stopServicesMap[stopGTFSID].services },
            'bays.$.screenServices': { $each: stopServicesMap[stopGTFSID].screenServices },
          }
        }
      }
    }))

    await mongoStops.bulkWrite(bulkUpdate)

    console.log('Loaded stop services for', operator)
  } catch (e) {
    errored = true
    console.log('Failed to load trips for', operator)
    console.log(e)
  }
}

await fs.writeFile(path.join(__dirname, 'directions.json'), JSON.stringify(directionIDMap))

console.log('Loading trips done, took', (new Date() - tripsStart) / 1000, 'seconds')

let shapeStart = new Date()
console.log('Loading shapes')

for (let operator of operators) {
  const operatorFolder = path.join(gtfsFolder, operator)
  const shapeFile = path.join(operatorFolder, 'shapes.txt')

  console.log('Loading shapes for', operator)
  let shapeLoader = new MTMRailShapeLoader(shapeFile, mongoDB)

  await shapeLoader.loadShapes({ shapeIDMap })
}

console.log('Loading shapes took', (new Date() - shapeStart) / 1000, 'seconds')

console.log('\nLoading both trips and shapes took', (new Date() - start) / 1000, 'seconds overall')

process.exit(errored ? 1 : 0)