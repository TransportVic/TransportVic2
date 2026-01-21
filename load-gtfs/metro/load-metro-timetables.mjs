import fs from 'fs'
import async from 'async'
import path from 'path'
import url from 'url'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'
import { MongoDatabaseConnection } from '@transportme/database'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let stops, timetables
let stationCache = {}

let lineGTFSIDs = {
  'Alamein': 'ALM',
  'Belgrave': 'BEG',
  'Craigieburn': 'CGB',
  'Cranbourne': 'CBE',
  'Frankston': 'FKN',
  'Glen Waverley': 'GWY',
  'Hurstbridge': 'HBE',
  'Lilydale': 'LIL',
  'Mernda': 'MDD',
  'Pakenham': 'PKM',
  'Sandringham': 'SHM',
  'Stony Point': 'STY',
  'Sunbury': 'SUY',
  'Upfield': 'UFD',
  'Werribee': 'WER',
  'Williamstown': 'WIL'
}

let lineNames = Object.keys(lineGTFSIDs)

let styConfigs = {
  8500: "1x SP",
  8502: "1x SP",
  8508: "1x SP",
  8510: "1x SP",
  8515: "1x SP",
  8517: "1x SP"
}

function dayCodeToArray (dayCode) {
  if (dayCode === '2' || dayCode === '4' || dayCode === '6') return ['Sun']
  if (dayCode === '1' || dayCode === '5') return ['Sat']
  if (dayCode === '3') return ['Mon', 'Tue', 'Wed', 'Thu']
  if (dayCode === '0') return ['Fri']

  throw new Error('Invalid day code ' + dayCode)
}

function minutesPastMidnightTo24Time(minutesPastMidnight) {
  let hours = Math.floor(minutesPastMidnight / 60)
  let minutes = minutesPastMidnight % 60

  return utils.pad(hours, 2) + ':' + utils.pad(minutes, 2)
}

const trips = {
}

const rawFormings = {}

function readFileData(filename, routeName, callback) {
  fs.readFile(path.join(__dirname, 'timetables', filename), async (err, buffer) => {
    if (err) return console.log(err)

    let rawData = JSON.parse(buffer.toString())

    await async.forEachSeries(rawData, async tripTiming => {
      if (tripTiming.orig_trip_id) return

      let runID = tripTiming.trip_id,
        tripDay = tripTiming.day_type,
        stationName = tripTiming.station,
        timeInSeconds = tripTiming.time_seconds,
        isArrival = tripTiming.is_arrival,
        platform = tripTiming.platform,
        forming = tripTiming.forms_trip_id

      if (runID === '0') return
      if (tripDay > 3) return

      let minutesPastMidnight = timeInSeconds / 60
      let timing = minutesPastMidnightTo24Time(minutesPastMidnight)

      let days = dayCodeToArray(tripDay)

      let tripID = runID + '-' + days.join('-')

      if (forming !== '0') rawFormings[tripID] = `${forming}-${days.join('-')}`

      let vehicleFormation = ''
      if (filename === 'stony-point.json') {
        vehicleFormation = styConfigs[runID] || '2x SP'
      }

      if (!trips[tripID]) trips[tripID] = {
        mode: 'metro train',
        routeName,
        routeGTFSID: '2-' + lineGTFSIDs[routeName],
        runID,
        operationDays: days,
        vehicle: vehicleFormation,
        formedBy: '',
        forming: '',
        operator: ['Metro Trains Melbourne'],
        stopTimings: {},
        connections: []
      }

      stationName = stationName.replace('St ', 'St. ')

      let station = stationCache[stationName]
      if (!station) {
        station = await stops.findDocument({
          bays: {
            $elemMatch: {
              mode: 'metro train',
              fullStopName: stationName + ' Railway Station'
            }
          }
        })
        stationCache[stationName] = station
      }

      let stationPlatform = station.bays.find(bay => bay.mode === 'metro train' && !bay.parentStopGTFSID)

      let properTiming = utils.getHHMMFromMinutesPastMidnight(minutesPastMidnight)

      trips[tripID].stopTimings[timing] = {
        stopName: stationPlatform.fullStopName,
        stopGTFSID: stationPlatform.stopGTFSID,
        suburb: stationPlatform.suburb,
        arrivalTime: properTiming,
        arrivalTimeMinutes: minutesPastMidnight,
        departureTime: properTiming,
        departureTimeMinutes: minutesPastMidnight,
        platform,
        sortTime: minutesPastMidnight,
        stopConditions: { pickup: 0, dropff: 0 }
      }
    })

    callback(0)
  })
}

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)

await database.connect({})
stops = database.getCollection('gtfs-stops')
timetables = database.getCollection('gtfs-timetables')

await timetables.deleteDocuments({ mode: 'metro train' })

let files = fs.readdirSync(path.join(__dirname, 'timetables'))

await async.forEachOf(files, async (filename, i) => {
  let lineName = lineNames[i]
  return new Promise(resolve => {
    readFileData(filename, lineName, resolve)
  })
})

for (const formingID of Object.keys(rawFormings)) {
  const tripTDN = formingID.split('-')[0]
  const formingTDN = rawFormings[formingID].split('-')[0]

  trips[formingID].forming = formingTDN
  if (trips[rawFormings[formingID]]) trips[rawFormings[formingID]].formedBy = tripTDN

  // console.log(tripTDN, 'forms', formingTDN)
}

const allTrips = Object.values(trips)

let weekdayTrips = allTrips.filter(trip => trip.operationDays[0] === 'Mon')
let fridayTrips = allTrips.filter(trip => trip.operationDays[0] === 'Fri')

let dupeFriday = fridayTrips.filter(trip => {
  let weekday = weekdayTrips.find(weekdayTrip => weekdayTrip.runID === trip.runID)
  if (weekday) {
    weekday.operationDays.push('Fri')
    return true
  } else {
    return false
  }
})

let monFriMerged = allTrips.filter(trip => !dupeFriday.includes(trip))

await async.forEach(monFriMerged, async trip => {
  trip.stopTimings = Object.values(trip.stopTimings)
    .sort((a, b) => a.sortTime - b.sortTime)
    .map(a => {
      delete a.sortTime
      return a
    })
  trip.stopTimings[0].arrivalTime = null
  trip.stopTimings[0].arrivalTimeMinutes = null
  let lastStop = trip.stopTimings.slice(-1)[0]

  lastStop.departureTime = null
  lastStop.departureTimeMinutes = null

  trip.origin = trip.stopTimings[0].stopName
  trip.departureTime = trip.stopTimings[0].departureTime
  trip.destination = lastStop.stopName
  trip.destinationArrivalTime = lastStop.arrivalTime

  let upService = !(trip.runID[3] % 2)
  trip.direction = upService ? 'Up' : 'Down'

  await timetables.createDocument(trip)
})

console.log('Completed loading in ' + monFriMerged.length + ' MTM WTT trips')
process.exit()