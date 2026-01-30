import { HeatTimetableFile } from '@transportme/vline-nsp-reader'
import { MongoDatabaseConnection } from '@transportme/database'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import config from '../../../config.json' with { type: 'json' }
import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import utils from '../../../utils.js'
import getTripID from '../../../modules/new-tracker/metro-rail-bus/get-trip-id.mjs'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function correctStopTimes(stop) {
  if (stop.arr === '13:39' && stop.dep === '17:45') {
    stop.arr = '17:41'
  }
}

function mergeTrips(tripA, tripB) {
  const allTimings = tripA.concat(tripB)

  return Object.values(allTimings.reduce((acc, stop) => {
    const existingStop = acc[stop.stopName]
    if (!existingStop) {
      acc[stop.stopName] = stop
      return acc
    }

    if (existingStop.departureTimeMinutes < stop.departureTimeMinutes) {
      existingStop.departureTime = stop.departureTime
      existingStop.departureTimeMinutes = stop.departureTimeMinutes
    } else {
      existingStop.arrivalTime = stop.arrivalTime
      existingStop.arrivalTimeMinutes = stop.arrivalTimeMinutes
    }
    return acc
  }, {})).sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)
}

/**
  'Monday to Friday', 'Saturday',
  'Sunday',           'M-F',
  'Mon',              'Fri',
  'Thu',              'Mon–Fri',
  'Saturday cont.',   'Sat',
  'Friday',           'M-F',
  'Mon-Fri',          'Tue-Sat',
  'Sat   cont.',      'Monday   to Friday',
  'M,Tu,Th',          'M,Tu,Th,F',
  'Sat, Sun',         'Sun',
  'M, W, F',          'Tue'
 */
function simplifyOperationDays(rawDay) {
  const day = rawDay.replace(/  +/g, ' ').replace('cont.', '').replace(/, /g, ',').replace(' to ', '-').replace('–', '-').trim()

  if (day === 'M-F') return 'Mon-Fri'
  if (day === 'Tue-Sat') return 'Tue-Sat'
  if (day === 'Monday-Friday') return 'Mon-Fri'
  if (day === 'M,W,F') return 'Mon,Wed,Fri'
  if (day === 'M,Tu,Th,F') return 'Mon,Tue,Thu,Fri'

  if (day === 'Friday') return 'Fri'
  if (day === 'Saturday') return 'Sat'
  if (day === 'Sunday') return 'Sun'

  return day
}

function expandOperationDays(days) {
  if (days.includes(',')) return days.split(',')
  if (days === 'Mon-Fri') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  return [days]
}

let heatTTFolder = path.join(__dirname, 'heat-timetables')
let heatTTFileNames = await fs.readdir(heatTTFolder)

let heatTTFiles = []
for (let file of heatTTFileNames) {
  if (!file.endsWith('.pdf')) continue
  let nspFile = HeatTimetableFile.fromFile(path.join(heatTTFolder, file))
  heatTTFiles.push(nspFile)
}

let timetables = mongoDB.getCollection('gtfs-timetables')
let heatTimetables = mongoDB.getCollection('gtfs-heat timetables')
let stops = mongoDB.getCollection('gtfs-stops')
let routes = mongoDB.getCollection('gtfs-routes')

let railStations = (await stops.findDocuments({
  'bays.mode': GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain
}).toArray()).reduce((acc, e) => {
  acc[e.stopName.slice(0, -16).toUpperCase()] = e
  return acc
}, {})

let allRouteData = (await routes.findDocuments({
  mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain
}, { routePaths: 0 }).toArray()).reduce((acc, route) => {
  acc[route.routeName] = route
  return acc
}, {})

let allRuns = []
for (let file of heatTTFiles.filter(file => allRouteData[file.line])) {
 console.log('Reading', file)
  let runs = await file.extractRuns()
  allRuns.push(...runs.filter(train => train.type === 'Train' && train.stops.length > 3).map(train => ({
    ...train,
    lineHint: file.line,
    type: file.type.toLowerCase()
  })))
}

let runs = {}
let daysUsed = {}

for (const run of allRuns) {
  if (!daysUsed[run.type]) daysUsed[run.type] = {}

  const stopTimings = run.stops.map(stop => {
    const cleanName = stop.name.replace(/station/i, '').replace(/ stn/i, '').trim().toUpperCase()
    const station = railStations[cleanName]
    if (!station) {
      console.log('Missing stop data', stop, cleanName)
      return null
    }
    const stationPlatform = station.bays.find(bay => bay.mode === GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain && !bay.parentStopGTFSID)

    correctStopTimes(stop)

    return {
      stopName: stationPlatform.fullStopName,
      stopGTFSID: stationPlatform.stopGTFSID,
      suburb: stationPlatform.suburb,
      arrivalTime: stop.arr,
      arrivalTimeMinutes: utils.getMinutesPastMidnightFromHHMM(stop.arr),
      departureTime: stop.dep,
      departureTimeMinutes: utils.getMinutesPastMidnightFromHHMM(stop.dep)
    }
  }).filter(Boolean)

  if (!stopTimings.length) {
    console.log('Discarded empty run', run)
    continue
  }

  let operationDay = simplifyOperationDays(run.operationDay)

  if (stopTimings[0].departureTimeMinutes < 3 * 60) {
    stopTimings[0].departureTimeMinutes += 1440
    if (operationDay === 'Tue-Sat') operationDay = 'Mon-Fri'
    else if (operationDay === 'Sat') operationDay = 'Fri'
    else if (operationDay === 'Sun') operationDay = 'Sat'
    else if (operationDay === 'Mon') operationDay = 'Sun'
    else console.warn('Unknown operation day', operationDay)
  }

  for (let i = 1; i < stopTimings.length; i++) {
    let prev = stopTimings[i - 1], stop = stopTimings[i]
    if (stop.arrivalTimeMinutes < prev.departureTimeMinutes) {
      stop.arrivalTimeMinutes += 1440
      stop.departureTimeMinutes += 1440
    } else if (stop.departureTimeMinutes < stop.arrivalTimeMinutes) {
      stop.departureTimeMinutes += 1440
    }
  }

  const operationDays = expandOperationDays(operationDay)

  const tripPatternID = [
    stopTimings[0].stopGTFSID, stopTimings[stopTimings.length - 1].stopGTFSID,
    stopTimings[0].departureTime, stopTimings[stopTimings.length - 1].arrivalTime,
    ...operationDays,
    run.type
  ].join('-')

  if (runs[tripPatternID] && runs[tripPatternID].stopTimings.length > stopTimings.length) continue

  runs[tripPatternID] = {
    run, stopTimings, operationDays
  }  
}

let bulkWrite = {}

for (let { run, stopTimings, operationDays } of Object.values(runs)) {
  // const lineData = allRouteData[run.lineHint]
  const originStop = stopTimings[0]
  const destStop = stopTimings[stopTimings.length - 1]
  const departureTime = originStop.departureTimeMinutes

  if (run.lineHint === 'Echuca') {
    const esmIndex = stopTimings.findIndex(stop => stop.stopName === 'Epsom Railway Station')
    const sssIndex = stopTimings.findIndex(stop => stop.stopName === 'Southern Cross Railway Station')
    const fsyIndex = stopTimings.findIndex(stop => stop.stopName === 'Footscray Railway Station')
    if (esmIndex !== -1 && sssIndex !== -1 && fsyIndex === -1) {
      const epsom = stopTimings[esmIndex], sss = stopTimings[sssIndex]
      const isDown = sssIndex < esmIndex
      const tripPatternID = (isDown ? [
        sss.stopGTFSID, epsom.stopGTFSID,
        sss.departureTime, epsom.arrivalTime,
        ...operationDays,
        run.type
      ] : [
        epsom.stopGTFSID, sss.stopGTFSID,
        epsom.departureTime, sss.arrivalTime,
        ...operationDays,
        run.type
      ]).join('-')

      const bendigoLocal = runs[tripPatternID]
      if (bendigoLocal) {
        stopTimings = isDown ? [
          ...bendigoLocal.stopTimings,
          ...stopTimings.slice(esmIndex + 1)
        ] : [
          ...stopTimings.slice(0, esmIndex),
          ...bendigoLocal.stopTimings,
        ]
      }
    }
  }

  let earlyThreshold = 1
  let lateThreshold = 20
  if (originStop.stopName === 'Southern Cross Railway Station') lateThreshold = 10
  if (originStop.stopName === 'Warrnambool Railway Station') lateThreshold = 45
  if (originStop.stopName === 'Ararat Railway Station') lateThreshold = 45
  if (originStop.stopName === 'Maryborough Railway Station') lateThreshold = 45
  if (originStop.stopName === 'Wendouree Railway Station') lateThreshold = 30
  if (originStop.stopName === 'Bendigo Railway Station') lateThreshold = 30
  if (originStop.stopName === 'Melton Railway Station') lateThreshold = 14
  if (originStop.stopName === 'Ballarat Railway Station' && destStop.stopName === 'Maryborough Railway Station') lateThreshold = 30

  if (originStop.stopName === 'Traralgon Railway Station' && destStop.stopName === 'Southern Cross Railway Station') earlyThreshold = 10

  let destinationStopQuery = destStop.stopName

  if (['Swan Hill', 'Bendigo'].includes(run.lineHint)) {
    earlyThreshold = 10
    if (originStop.stopName === 'Southern Cross Railway Station') lateThreshold = 20
    if (originStop.stopName === 'Southern Cross Railway Station' && originStop.departureTimeMinutes > 19 * 60) earlyThreshold = 20
    if (destinationStopQuery === 'Epsom Railway Station') destinationStopQuery = {
      $in: [
        'Epsom Railway Station',
        'Bendigo Railway Station'
      ]
    }
  }

  let matchingTrips = await timetables.findDocuments({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: operationDays[0],
    'stopTimings.0.stopName': originStop.stopName,
    'stopTimings.0.departureTimeMinutes': {
      $gte: departureTime - lateThreshold,
      $lte: departureTime + earlyThreshold
    },
    'stopTimings.stopName': destinationStopQuery
  }).toArray()

  if (!matchingTrips.length) {
    matchingTrips = await timetables.findDocuments({
      mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
      operationDays: operationDays[0],
      $and: [{
        stopTimings: {
          $elemMatch: {
            stopName: originStop.stopName,
            departureTimeMinutes: {
              $gte: departureTime - lateThreshold,
              $lte: departureTime + earlyThreshold
            }
          }
        }
      }, {
        stopTimings: {
          $elemMatch: {
            stopName: destinationStopQuery,
            departureTimeMinutes: {
              $gte: departureTime
            }
          }
        }
      }]
    }).toArray()
  }

  if (!matchingTrips.length) {
    // console.log(run, operationDays, stopTimings)

    matchingTrips = [{
      stopTimings: [{ departureTimeMinutes: departureTime }],
      mode: 'regional train',
      routeName: run.lineHint,
      routeGTFSID: allRouteData[run.lineHint].routeGTFSID,
      operationDays,
      runID: getTripID(`${operationDays[0]}-${run.lineHint}-${departureTime}-${originStop.stopName}-${destStop.stopName}`)
    }]
  }

  const matchingTrip = matchingTrips.map(trip => ({
    trip,
    closeness: Math.abs(trip.stopTimings[0].departureTimeMinutes - departureTime)
  })).sort((a, b) => a.closeness - b.closeness)[0].trip

  let id = `${matchingTrip.runID}-${matchingTrip.operationDays[0]}-${run.type}`

  if (bulkWrite[id]) {
    stopTimings = mergeTrips(bulkWrite[id].replaceOne.replacement.stopTimings, stopTimings)
  }

  const timetable = {
    ...matchingTrip,
    stopTimings,
    origin: originStop.stopName,
    destination: destStop.stopName,
    departureTime: originStop.departureTime,
    destinationArrivalTime: destStop.arrivalTime,
    formedBy: null, forming: null,
    type: run.type
  }
  delete timetable._id

  bulkWrite[id] = {
    replaceOne: {
      filter: {
        mode: timetable.mode,
        runID: timetable.runID,
        operationDays: timetable.operationDays[0],
        type: timetable.type
      },
      replacement: timetable,
      upsert: true
    }
  }
}

await heatTimetables.bulkWrite(Object.values(bulkWrite))
process.exit(0)
