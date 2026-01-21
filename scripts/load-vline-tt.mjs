import { PassPDFReader } from '@transportme/vline-nsp-reader'
import { MongoDatabaseConnection } from '@transportme/database'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import config from '../config.json' with { type: 'json' }
import path from 'path'
import url from 'url'
import utils from '../utils.mjs'
import async from 'async'
import getTripID from '../modules/new-tracker/metro-rail-bus/get-trip-id.mjs'
import { RouteLoader, StopsLoader } from '@transportme/load-ptv-gtfs'
import GTFSStopsReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSStopsReader.mjs'
import GTFSRouteReader from '@transportme/load-ptv-gtfs/lib/gtfs-parser/readers/GTFSRouteReader.mjs'
import GTFSAgency from '@transportme/load-ptv-gtfs/lib/gtfs-parser/GTFSAgency.mjs'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class DirectStopLoader extends StopsLoader {
  getStopsDB(db) { return db.getCollection('stops') }
}

class VLineRouteLoader extends RouteLoader {

  #vline

  constructor(database) {
    super('', '', GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain, database)
  }

  async loadAgencies() {
    this.#vline = new GTFSAgency({
      id: 'vline',
      name: 'V/Line'
    })
  }

  getOperator(id) {
    return this.#vline
  }

  getRoutesDB(db) { 
    return db.getCollection('routes')
  }

}

const suburbs = { features: [] }

let routeLoader = new VLineRouteLoader(mongoDB)
let routeReader = new GTFSRouteReader('', GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain)
await routeLoader.loadAgencies()

const stopLoader = new DirectStopLoader('', suburbs, GTFS_CONSTANTS.TRANSIT_MODES.regionalCoach, mongoDB)
const stopReader = new GTFSStopsReader('', suburbs)
await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "20968",
  "stop_name": "Werribee Railway Station/Manly Street (Werribee)",
  "stop_lat": "-37.89892473135621",
  "stop_lon": "144.66050609871286",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "vic:rail:LAV-RRB",
  "stop_name": "Laverton Railway Station/Railway Avenue (Laverton)",
  "stop_lat": "-37.86435558873784",
  "stop_lon": "144.7717901601029",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "vic:rail:WGS-RRB",
  "stop_name": "Watergardens Railway Station/Watergardens Circuit Road (Watergardens)",
  "stop_lat": "-37.69992193414763",
  "stop_lon": "144.77348181016202",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "1",
  "stop_name": "Sunshine Railway Station/City Place (Sunshine)",
  "stop_lat": "-37.78774462",
  "stop_lon": "144.83197021",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "27537",
  "stop_name": "Deer Park Railway Station/Railway Parade (Deer Park)",
  "stop_lat": "-37.77730825",
  "stop_lon": "144.77109111",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "52533",
  "stop_name": "Ardeer Railway Station/Forrest Street (Ardeer)",
  "stop_lat": "-37.78279234",
  "stop_lon": "144.80204855",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "48832",
  "stop_name": "Cobblebank Railway Station (Cobblebank)",
  "stop_lat": "-37.71281526",
  "stop_lon": "144.60363406",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await stopLoader.loadStop(stopReader.processEntity({
  "stop_id": "22028",
  "stop_name": "Rockbank Railway Station (Rockbank)",
  "stop_lat": "-37.72925023",
  "stop_lon": "144.65052972",
  "parent_station": "",
  "location_type": "1",
  "platform_code": ""
}))

await routeLoader.loadRoute(routeReader.processEntity({
  "route_id": "5-MBY",
  "agency_id": "vline",
  "route_short_name": "Maryborough",
  "route_long_name": "Maryborough"
}))

let ttFiles = []
for (let file of process.argv.slice(2)) {
  if (!file.endsWith('.pdf')) continue
  let nspFile = new PassPDFReader(path.resolve(process.cwd(), file))
  ttFiles.push(nspFile)
}

const shiftOpDay = process.argv.includes('--shift-op-day')
const coachOnly = process.argv.includes('--coach-only')
const defaultMonth = (() => {
  const arg = process.argv.find(a => a.startsWith('--default-month'))
  if (!arg) return null
  return arg.split('=')[1]
})()

const rewriteOpDay = process.argv.filter(a => a.startsWith('--change-op-day')).map(arg => {
  return arg.split('=').slice(1)
}).reduce((acc, arg) => ({
  ...acc,
  [arg[0]]: arg[1]
}), {})

const restrictOriginDest = process.argv.filter(a => a.startsWith('--restrict-origin-dest')).flatMap(arg => {
  return arg.split('=')[1].split(',')
})

function expandOperationDays(days) {
  const currentYear = new Date().getFullYear().toString()
  const originalFullDay = (days.match(/\d+$/) ? `${days} ${defaultMonth}` : days).replace('cont.', '').trim()
  const fullDays = rewriteOpDay[originalFullDay] || originalFullDay

  const parts = fullDays.split(' ')
  const front = parts.slice(0, -1).join(' ')
  const month = parts[parts.length - 1] || defaultMonth

  const parseDay = day => utils.parseTime(new Date(`${day} ${month} ${currentYear}`))

  if (fullDays.includes('&')) {
    const days = front.split(' & ')
    return days.map(parseDay).map(day => utils.getYYYYMMDD(day))
  } else if (fullDays.includes(' to ') || fullDays.includes(' – ')) {
    const days = front.replace(/ ?– ?/, ' to ').split(' to ')
    const start = parseDay(days[0]), end = parseDay(days[1])
    const dayCount = end.diff(start, 'days') + 1
    return Array(dayCount).fill(0).map((_, i) => utils.getYYYYMMDD(start.clone().add(i, 'days')))
  }

  // Eg: Sun 18 needs default month
  return [ utils.getYYYYMMDD(parseDay(`${fullDays} ${parts.length == 2 ? defaultMonth : ''} ${currentYear}`)) ]
}

let gtfsTimetables = mongoDB.getCollection('gtfs timetables')
let stops = mongoDB.getCollection('stops')
let routes = mongoDB.getCollection('routes')

let railStations = (await stops.findDocuments({
  $or: [{
    'bays.mode': GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain
  }, {
    'bays.mode': GTFS_CONSTANTS.TRANSIT_MODES.regionalCoach
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
  if (run.type === 'Metro') return null

  const mode = run.type === 'Train' ? 'regional train' : 'regional coach'
  if (coachOnly && run.type === 'Train') return null

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
  let operationDays = expandOperationDays(run.operationDay)
  operationDays = rewriteOpDay[operationDays.join('-')]?.split(',') || operationDays

  if (stopTimings[0].departureTimeMinutes < 3 * 60) {
    stopTimings[0].departureTimeMinutes += 1440
    if (shiftOpDay) operationDays = operationDays.map(d => utils.getYYYYMMDD(utils.parseDate(d).add(-1, 'day')))
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

  const WER_LAV = ['Werribee', 'Laverton'].map(x => x + ' Railway Station')
  const WGS_MEL = ['Watergardens', 'Melton', 'Cobblebank'].map(x => x + ' Railway Station')
  
  let allRouteData = await routes.findDocuments({
    mode: 'regional train',
    $and: [{
      'directions.stops.stopName': originName
    }, {
      'directions.stops.stopName': destName
    }]
  }, { directions: 1, routeGTFSID: 1, routeName: 1 }).toArray()

  let routeData = allRouteData.map(routeData => {
    let dir = routeData.directions.find(dir => {
      const originIndex = dir.stops.findIndex(stop => stop.stopName === originName)
      const destIndex = dir.stops.findIndex(stop => stop.stopName === destName)
      return originIndex > -1 && destIndex > -1 && originIndex < destIndex
    })

    routeData.dir = dir
    return routeData
  }).filter(r => r.dir).sort((a, b) => a.directions[0].stops.length - b.directions[0].stops.length)[0]
  let dir = routeData ? routeData.dir : null

  if (WER_LAV.includes(originName) || WER_LAV.includes(destName)) {
    routeData = await routes.findDocument({
      mode: 'regional train',
      routeName: 'Geelong'
    })

    const up = WER_LAV.includes(destName)
    if (up) dir = routeData.directions.find(d => d.directionName.includes('Southern Cross'))
    else dir = routeData.directions.find(d => !d.directionName.includes('Southern Cross'))
  }

  if (WGS_MEL.includes(originName) && WGS_MEL.includes(destName)) {
    routeData = await routes.findDocument({
      mode: 'regional train',
      routeName: 'Ballarat'
    })

    const up = destName === 'Watergardens Railway Station'
    if (up) dir = routeData.directions.find(d => d.directionName.includes('Southern Cross'))
    else dir = routeData.directions.find(d => !d.directionName.includes('Southern Cross'))
  }

  if (restrictOriginDest.length) {
    if (!(restrictOriginDest.includes(originName) || restrictOriginDest.includes(destName))) return null
  }

  if (!dir) console.log(stopTimings, originName, destName, run)

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
    direction: dir.directionName.includes('Southern Cross') ? 'Up' : 'Down',
    manualOccoTrip: true
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