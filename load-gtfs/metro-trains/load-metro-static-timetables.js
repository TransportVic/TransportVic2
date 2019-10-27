const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = null
let timetables = null

const fs = require('fs')
const async = require('async')

const EventEmitter = require('events')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

const lines = [
  'Alamein',
  'Belgrave',
  'Craigieburn',
  'Cranbourne',
  'Mernda',
  'Frankston',
  'Glen Waverley',
  'Hurstbridge',
  'Lilydale',
  'Pakenham',
  'Sandringham',
  'Stony Point',
  'Sunbury',
  'Upfield',
  'Werribee',
  'Williamstown'
]

let timetableCount = 0;

function dayCodeToArray (dayCode) {
  if (dayCode === '0') return ['Fri']
  if (dayCode === '1') return ['Sat']
  if (dayCode === '2') return ['Sun']
  if (dayCode === '3') return ['Mon', 'Tues', 'Wed', 'Thur']
  throw new Error('Invalid day code')
}

let stationLoaders = {}
let stationCache = {}
async function getStation(stationName) {
  if (stationLoaders[stationName]) {
    return await new Promise(resolve => stationLoaders[stationName].on('loaded', resolve))
  } else if (!stationCache[stationName]) {
    stationLoaders[stationName] = new EventEmitter()
    stationLoaders[stationName].setMaxListeners(1000)

    let station = await stops.findDocument({
      stopName: stationName
    })

    let metroStation = station.bays.filter(bay => bay.mode === 'metro train')[0]

    stationCache[stationName] = metroStation
    stationLoaders[stationName].emit('loaded', metroStation)
    delete stationLoaders[stationName]

    return metroStation
  } else return stationCache[stationName]
}

function minutesPastMidnightTo24Time(minutesPastMidnight) {
  let hours = Math.floor(minutesPastMidnight / 60)
  let minutes = minutesPastMidnight % 60

  return utils.pad(hours, 2) + ':' + utils.pad(minutes, 2)
}

async function parseTimetable(data, routeName) {
  let timetableByDays = {0: {}, 1: {}, 2: {}, 3: {}};
  await async.forEach(data, async stop => {
    const runID = stop.trip_id,
        tripDay = stop.day_type,
        stationName = stop.station,
        {arrivalTimeMinutes} = stop

    const stationData = await getStation(stationName)
    const arrivalTime = minutesPastMidnightTo24Time(arrivalTimeMinutes)

    if (!timetableByDays[tripDay][runID]) timetableByDays[tripDay][runID] = {
      mode: 'metro train',
      operator: 'Metro Trains Melbourne',
      routeName,
      runID,
      operationDays: dayCodeToArray(tripDay),
      vehicle: null,
      formedBy: null,
      forming: null,
      stopTimings: [],
      destination: null,
      departureTime: null,
      origin: null,
      direction: stop.to_city === '1' ? 'Up' : 'Down'
    }
    if (!stationData) console.log(stationName)

    timetableByDays[tripDay][runID].stopTimings.push({
      stopName: stationName,
      stopGTFSID: stationData.stopGTFSID,
      arrivalTime,
      arrivalTimeMinutes,
      departureTime: arrivalTime,
      departureTimeMinutes: arrivalTimeMinutes,
      platform: null,
      stopConditions: ""
    })
  })

  await async.forEach([0, 1, 2, 3], async i => {
    await async.forEach(Object.keys(timetableByDays[i]), async runID => {
      const timetableData = timetableByDays[i][runID]
      let stopCount = timetableData.stopTimings.length

      timetableData.stopTimings = timetableData.stopTimings.sort((a, b) => a.arrivalTimeMinutes - b.arrivalTimeMinutes)

      timetableData.stopTimings[0].arrivalTime = null
      timetableData.stopTimings[0].arrivalTimeMinutes = null

      timetableData.stopTimings[stopCount - 1].departureTime = null
      timetableData.stopTimings[stopCount - 1].departureTimeMinutes = null

      timetableData.origin = timetableData.stopTimings[0].stopName
      timetableData.departureTime = timetableData.stopTimings[0].departureTime
      timetableData.destinationArrivalTime = timetableData.stopTimings[stopCount - 1].arrivalTime
      timetableData.destination = timetableData.stopTimings[stopCount - 1].stopName

      const key = {
        mode: 'metro train',
        runID,
        operationDays: timetableData.operationDays,
        destination: timetableData.destination,
        origin: timetableData.origin
      }

      timetableCount++

      await timetables.replaceDocument(key, timetableData, {
        upsert: true
      })
    })
  })
}

async function loadLineJSON(routeName) {
  let codedLineName = utils.encodeName(routeName)
  let data = JSON.parse(fs.readFileSync('load-gtfs/metro-trains/timetables/' + codedLineName + '.json').toString())
  data = data.map(stop => {
    stop.time_seconds = parseInt(stop.time_seconds)
    stop.arrivalTimeMinutes = stop.time_seconds / 60
    stop.station += ' Railway Station'
    return stop
  })

  await parseTimetable(data, routeName);
}

database.connect({
  poolSize: 500
}, async err => {
  stops = database.getCollection('stops')
  timetables = database.getCollection('timetables')

  timetables.createIndex({
    mode: 1,
    operator: 1,
    routeName: 1,
    runID: 1,
    operationDays: 1,
    origin: 1,
    destination: 1
  }, {unique: true})

  let i = -1
  async function loadLine() {
    if (i++ === lines.length - 1) return

    const routeName = lines[i]
    await loadLineJSON(routeName)

    await loadLine()
  }

  await loadLine()

  await updateStats('mtm-timetables', timetableCount, new Date() - start)
  console.log('Completed loading in ' + timetableCount + ' MTM timetables')
  process.exit()
})
