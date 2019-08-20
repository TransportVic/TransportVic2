const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let vlineRailwayStations = null
let vnetTimetables = null

const fs = require('fs')
const parseCSV = require('csv-parse')
const async = require('async')

const files = [
  'FP50 Eastern Weekday 220319 - Up',
  'FP50 Eastern Weekday 220319 - Down',
  'FP50 Eastern Saturday 220319 - Up',
  'FP50 Eastern Saturday 220319 - Down',
  'FP50 Eastern Sunday 220319 - Up',
  'FP50 Eastern Sunday 220319 - Down',

  'FP50 NESG All Days 220319 - Up',
  'FP50 NESG All Days 220319 - Down',

  'FP50 North Eastern Weekday 220319 - Up',
  'FP50 North Eastern Weekday 220319 - Down',
  'FP50 North Eastern Saturday 220319 - Up',
  'FP50 North Eastern Saturday 220319 - Down',
  'FP50 North Eastern Sunday 220319 - Up',
  'FP50 North Eastern Sunday 220319 - Down',

  'FP50 Northern Weekday 220319 - Up',
  'FP50 Northern Weekday 220319 - Down',
  'FP50 Northern Saturday 220319 - Up',
  'FP50 Northern Saturday 220319 - Down',
  'FP50 Northern Sunday 220319 - Up',
  'FP50 Northern Sunday 220319 - Down',

  'FP50 South Western Weekday 290319 - Up',
  'FP50 South Western Weekday 290319 - Down',
  'FP50 South Western Saturday 290319 - Up',
  'FP50 South Western Saturday 290319 - Down',
  'FP50 South Western Sunday 290319 - Up',
  'FP50 South Western Sunday 290319 - Down',

  'FP50 Western Weekday 220319 - Up',
  'FP50 Western Weekday 220319 - Down',
  'FP50 Western Saturday 220319 - Up',
  'FP50 Western Saturday 220319 - Down',
  'FP50 Western Sunday 220319 - Up',
  'FP50 Western Sunday 220319 - Down'
]

let terminiToLines = {
  'Albury': 'Albury',

  'Ararat': 'Ararat',

  'Bairnsdale': 'Bairnsdale',
  'Sale': 'Bairnsdale',

  'Bendigo': 'Bendigo',
  'Eaglehawk': 'Bendigo',
  'Epsom': 'Bendigo',
  'Kyneton': 'Bendigo',

  'Bacchus Marsh': 'Ballarat',
  'Ballarat': 'Ballarat',
  'Wendouree': 'Ballarat',
  'Melton': 'Ballarat',

  'Echuca': 'Echuca',

  'Geelong': 'Geelong',
  'South Geelong': 'Geelong',
  'Waurn Ponds': 'Geelong',
  'Wyndham Vale': 'Geelong',

  'Maryborough': 'Maryborough',
  'Maryborough-Ballarat': 'Maryborough',

  'Seymour': 'Seymour',

  'Shepparton': 'Shepparton',

  'Swan Hill': 'Swan Hill',
  'Swan Hill-Bendigo': 'Swan Hill',

  'Traralgon': 'Traralgon',

  'Warnambool': 'Warnambool'
}

function operatingDaysToArray (days) {
  if (days === 'MF') return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri']
  if (days === 'Sat') return ['Sat']
  if (days === 'Sun' || days === 'SuO') return ['Sun']
  if (days === 'Sat+Sun' || days === 'Sun+Sat') return ['Sat', 'Sun']
  if (days === 'ME') return ['Tues', 'Wed', 'Thur', 'Fri']
  if (days === 'MO') return ['Mon']
  if (days === 'FO') return ['Fri']
  if (days === 'Daily') return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun']
  throw Error('Unknown date')
}

function timingToMinutesAfterMidnight (timing) {
  if (!timing) return null
  const parts = timing.slice(0, 5).split(':')
  return parts[0] * 60 + parts[1] * 1
}

let timetableCount = 0

async function loadTimetableCSV (filename) {
  let timetable = fs.readFileSync('vline_timetables/' + filename + '.csv').toString()
  timetable = await new Promise(resolve => parseCSV(timetable, {
    trim: true,
    skip_empty_lines: true
  }, (err, t) => resolve(t)))

  let leftColumns = timetable.map(row => row.slice(0, 2))
  const tripCount = timetable[0].length - 2
  const trips = []

  for (let i = 0; i < tripCount; i++) {
    const tripData = []
    for (let j = 0; j < leftColumns.length; j++) {
      tripData.push(timetable[j][i + 2])
    }
    trips.push(tripData)
  }

  let prevStation = ''
  leftColumns = leftColumns.slice(5, -1).map(e => {
    if (e[0]) prevStation = e[0]
    else e[0] = prevStation
    return e
  })
  const routeStops = leftColumns.map(e => e[0]).filter((e, i, a) => a.indexOf(e) === i)

  return { trips, routeStops, leftColumns }
}

async function loadTrips (csvData) {
  const { trips, routeStops, leftColumns } = csvData

  await async.map(trips, async trip => {
    timetableCount++
    const tripMeta = trip.slice(0, 5).concat(trip.slice(-1))
    const tripTimings = trip.slice(5, -1)

    const runID = tripMeta[0]
    const operationDays = operatingDaysToArray(tripMeta[1])
    const vehicle = tripMeta[2]
    const formedBy = tripMeta[3]
    const forming = tripMeta[5]

    const tripStops = {}

    let i = 0
    await async.map(tripTimings, async timing => {
      if (timing === '…/…') timing = ''

      const stationMeta = leftColumns[i++]
      const stationName = stationMeta[0]
      const fieldContents = stationMeta[1]

      const station = await vlineRailwayStations.findDocument({ name: new RegExp(stationName + ' railway station', 'i') })

      let arrivalTime = null; let departureTime = null
      if (!tripStops[stationName]) {
        tripStops[stationName] = {
          stationName: station.name,
          gtfsID: station.gtfsID,
          arrivalTime: null,
          departureTime: null,
          platform: null
        }
      }

      if (timing.includes('/')) {
        timing = timing.split('/')
        arrivalTime = timing[0]
        departureTime = timing[1]
        tripStops[stationName].arrivalTime = arrivalTime
        tripStops[stationName].departureTime = departureTime

        return
      }

      if (timing.includes('*')) tripStops[stationName].express = true
      if (fieldContents === 'Arr') tripStops[stationName].arrivalTime = timing
      else if (fieldContents === 'Dep') tripStops[stationName].departureTime = timing
      else if (fieldContents === 'Plat') tripStops[stationName].platform = timing
      else {
        tripStops[stationName].arrivalTime = timing
        tripStops[stationName].departureTime = timing
      }
    })

    let stops = routeStops.map(name => tripStops[name]).filter(Boolean).filter(e => !e.express).filter(e => e.arrivalTime + e.departureTime !== '')

    const destination = stops.slice(-1)[0].stationName
    const departureTime = stops[0].departureTime
    const origin = stops[0].stationName

    const l = stops.length - 1
    stops = stops.map((stop, i) => {
      if (i === 0) stop.arrivalTime = null
      if (i === l) stop.departureTime = null
      stop.arrivalTimeMinutes = timingToMinutesAfterMidnight(stop.arrivalTime)
      stop.departureTimeMinutes = timingToMinutesAfterMidnight(stop.departureTime)

      return stop
    })

    const originDest = `${origin.slice(0, -16)}-${destination.slice(0, -16)}`
    const dest = destination.slice(0, -16)
    const line = terminiToLines[originDest] || terminiToLines[origin.slice(0, -16)] || terminiToLines[dest]

    const key = {
      runID, operationDays, destination, departureTime, origin
    }
    const timetableData = {
      runID, operationDays, vehicle, formedBy, forming, stops, destination, departureTime, origin, line
    }

    if (await vnetTimetables.countDocuments(key)) {
      await vnetTimetables.updateDocument(key, {
        $set: timetableData
      })
    } else {
      await vnetTimetables.createDocument(timetableData)
    }
  })
}

database.connect({
  poolSize: 100
}, async err => {
  vlineRailwayStations = database.getCollection('vline railway stations')
  vnetTimetables = database.getCollection('vnet timetables')

  await async.map(files, async filename => {
    const csvData = await loadTimetableCSV(filename)
    await loadTrips(csvData)
  })
  console.log('Completed loading in ' + timetableCount + ' VNET timetables')
  process.exit()
})
