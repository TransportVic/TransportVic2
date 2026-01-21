import { NSPFile } from '@transportme/vline-nsp-reader'
import { MongoDatabaseConnection } from '@transportme/database'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import config from '../../../config.json' with { type: 'json' }
import currentVersion from './timetables/ver.json' with { type: 'json' }
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import utils from '../../../utils.mjs'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let nspFolder = path.join(__dirname, 'timetables')
let nspFileNames = await fs.readdir(nspFolder)

let nspFiles = []
for (let file of nspFileNames) {
  if (!file.endsWith('.pdf') || file.includes('Central') || file.includes('Freight')) continue
  let nspFile = new NSPFile(file.slice(0, -4), null, currentVersion.version)
  nspFile.setFilePath(path.join(nspFolder, file))
  nspFiles.push(nspFile)
}

let allRuns = {}

for (let file of nspFiles) {
 console.log('Reading', file)
  let runs = await file.extractRuns()
  for (let run of runs) {
    if (run.movementType !== 'PSNG_SRV') continue
    let runID = `${run.tdn}-${run.daysRunCode}`
    if (!allRuns[runID]) allRuns[runID] = run
  }
}

let timetables = mongoDB.getCollection('gtfs-timetables')
let stops = mongoDB.getCollection('gtfs-stops')
let routes = mongoDB.getCollection('gtfs-routes')

let railStations = (await stops.findDocuments({
  'bays.mode': {
    $in: [ GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain ]
  }
}).toArray()).reduce((acc, e) => {
  acc[e.stopName.slice(0, -16).toUpperCase()] = e
  return acc
}, {})

let routeIDs = (await routes.findDocuments({
  mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain
}).toArray()).reduce((acc, e) => {
  acc[e.routeName] = e.routeGTFSID
  return acc
}, {})

let bulkWrite = []

for (let run of Object.values(allRuns)) {
  let timetable = {
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    routeName: run.routeName,
    routeGTFSID: routeIDs[run.routeName],
    runID: run.tdn,
    operationDays: run.daysRun,
    vehicle: run.vehicleType,
    isConditional: run.conditional,
    formedBy: run.formedBy.split(' ')[0],
    forming: run.forming.split(' ')[0],
    operator: 'V/Line',
    stopTimings: run.stations.filter(stop => {
      return railStations[stop.name.toUpperCase()]
    }).map(stop => {
      let station = railStations[stop.name.toUpperCase()]
      let stationPlatform = station.bays.find(bay => bay.mode === GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain && !bay.parentStopGTFSID)
      if (!stationPlatform) stationPlatform = station.bays.find(bay => bay.mode === GTFS_CONSTANTS.TRANSIT_MODES.metroTrain && !bay.parentStopGTFSID)

      return {
        stopName: stationPlatform.fullStopName,
        stopGTFSID: stationPlatform.stopGTFSID,
        suburb: stationPlatform.suburb,
        arrivalTime: stop.arrTime,
        arrivalTimeMinutes: utils.getMinutesPastMidnightFromHHMM(stop.arrTime),
        departureTime: stop.depTime,
        departureTimeMinutes: utils.getMinutesPastMidnightFromHHMM(stop.depTime),
        platform: stop.plat,
        track: stop.track,
        express: stop.express
      }
    }),
    // flags: {
    //   tripDivides,
    //   tripDividePoint,
    //   tripAttaches,
    //   tripAttachPoint
    // },
    direction: !(run.tdn[3] % 2) ? 'Up' : 'Down'
  }

  if (timetable.stopTimings[0].departureTimeMinutes < 3 * 60) {
    timetable.stopTimings[0].departureTimeMinutes += 1440
  }

  for (let i = 1; i < timetable.stopTimings.length; i++) {
    let prev = timetable.stopTimings[i - 1], stop = timetable.stopTimings[i]
    if (stop.arrivalTimeMinutes < prev.departureTimeMinutes) {
      stop.arrivalTimeMinutes += 1440
      stop.departureTimeMinutes += 1440
    } else if (stop.departureTimeMinutes < stop.arrivalTimeMinutes) {
      stop.departureTimeMinutes += 1440
    }
  }

  let lastStop = timetable.stopTimings[timetable.stopTimings.length - 1]
  let firstStop = timetable.stopTimings[0]
  timetable.origin = firstStop.stopName
  timetable.departureTime = firstStop.departureTime
  timetable.destination = lastStop.stopName
  timetable.destinationArrivalTime = lastStop.arrivalTime

  bulkWrite.push({
    replaceOne: {
      filter: { mode: timetable.mode, runID: timetable.runID, operationDays: timetable.operationDays[0] },
      replacement: timetable,
      upsert: true
    }
  })
}

await timetables.bulkWrite(bulkWrite)
process.exit(0)