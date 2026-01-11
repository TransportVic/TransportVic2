import { PassPDFReader } from '@transportme/vline-nsp-reader'
import { MongoDatabaseConnection } from '@transportme/database'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import config from '../config.json' with { type: 'json' }
import path from 'path'
import url from 'url'
import utils from '../utils.js'
import async from 'async'
import getTripID from '../modules/new-tracker/metro-rail-bus/get-trip-id.mjs'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let ttFiles = []
for (let file of process.argv.slice(2)) {
  if (!file.endsWith('.pdf')) continue
  let nspFile = new PassPDFReader(path.resolve(__dirname, file))
  ttFiles.push(nspFile)
}

function expandOperationDays(days) {
  const currentYear = new Date().getFullYear().toString()
  const parts = days.split(' ')
  const front = parts.slice(0, -1).join(' ')
  const month = parts[parts.length - 1]

  const parseDay = day => utils.parseTime(new Date(`${day} ${month} ${currentYear}`))

  if (days.includes('&')) {
    const days = front.split(' & ')
    return days.map(parseDay).map(day => utils.getYYYYMMDD(day))
  } else if (days.includes(' to ')) {
    const days = front.split(' to ')
    const start = parseDay(days[0]), end = parseDay(days[1])
    const dayCount = end.diff(start, 'days') + 1
    return Array(dayCount).fill(0).map((_, i) => utils.getYYYYMMDD(start.clone().add(i, 'days')))
  }

  return [ utils.getYYYYMMDD(parseDay(`${days} ${currentYear}`)) ]
}

let gtfsTimetables = mongoDB.getCollection('gtfs timetables')
let stops = mongoDB.getCollection('stops')
let routes = mongoDB.getCollection('routes')

let railStations = (await stops.findDocuments({
  $or: [{
    'bays.mode': GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain
  }, {
    stopName: 'Southern Cross Coach Terminal/Spencer Street'
  }]
}, { textQuery: 0 }).toArray()).reduce((acc, e) => {
  acc[e.stopName.replace(' Railway Station', '').toUpperCase()] = e
  return acc
}, {})

const allRuns = await async.flatMap(ttFiles, async file => {
  return await file.readRuns()
})

const trips = (await async.map(allRuns, async run => {
  const mode = run.type === 'Train' ? 'regional train' : 'regional coach'
  const stopTimings = run.stops.map(stop => {
    const cleanName = stop.name.replace(/station/i, '').replace(/ stn/i, '').trim().toUpperCase()
    const station = (cleanName === 'SOUTHERN CROSS' && mode === 'regional coach') ?
        railStations['SOUTHERN CROSS COACH TERMINAL/SPENCER STREET']
      : railStations[cleanName]

    if (!station) {
      console.log('Missing stop data', mode, stop, cleanName)
      return null
    }

    const stationPlatform = station.bays.find(bay => bay.mode === mode && !bay.parentStopGTFSID)

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

  if (stopTimings.length === 1) return null

  const operationDays = expandOperationDays(run.operationDay)

  if (stopTimings[0].departureTimeMinutes < 3 * 60) {
    stopTimings[0].departureTimeMinutes += 1440
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

  const originStop = stopTimings[0]
  const destStop = stopTimings[stopTimings.length - 1]

  const originName = originStop.stopName.split('/')[0].replace('Coach Terminal', 'Railway Station')
  const destName = destStop.stopName.split('/')[0].replace('Coach Terminal', 'Railway Station')

  const allRouteData = await routes.findDocuments({
    mode: 'regional train',
    $and: [{
      'directions.stops.stopName': originName
    }, {
      'directions.stops.stopName': destName
    }]
  }, { directions: 1, routeGTFSID: 1, routeName: 1 }).toArray()
  const routeData = allRouteData.sort((a, b) => a.directions[0].stops.length - b.directions[0].stops.length)[0]

  const dir = routeData.directions.find(dir => {
    const originIndex = dir.stops.findIndex(stop => stop.stopName === originName)
    const destIndex = dir.stops.findIndex(stop => stop.stopName === destName)
    return originIndex > -1 && destIndex > -1 && originIndex < destIndex
  })

  const tripID = `${routeData.routeGTFSID}-${operationDays[0]}-${originStop.stopGTFSID}-${originStop.departureTime}-${destStop.arrivalTime}`

  return {
    mode,
    routeGTFSID: mode === 'regional train' ? routeData.routeGTFSID : `5-${routeData.routeGTFSID.slice(-3)}`,
    routeName: routeData.routeName,
    operationDays,
    tripID,
    runID: getTripID(tripID),
    isRailReplacementBus: mode === 'regional coach',
    stopTimings,
    origin: originStop.stopName,
    destination: destStop.stopName,
    departureTime: originStop.departureTime,
    destinationArrivalTime: destStop.arrivalTime,
    formedBy: null, forming: null,
    gtfsDirection: dir.gtfsDirection,
    direction: dir.directionName.includes('Southern Cross')? 'Up' : 'Down'
  }
})).filter(Boolean)

await gtfsTimetables.bulkWrite(trips.map(trip => ({
  replaceOne: {
    filter: { mode: trip.mode, tripID: trip.tripID },
    replacement: trip,
    upsert: true
  }
})))

console.log('Created', trips.length, 'trips')

process.exit(0)