const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null
let timetables = null

const fs = require('fs')
const parseCSV = require('csv-parse')
const async = require('async')

const files = [
  'FP50 Eastern Weekday - Up',
  'FP50 Eastern Weekday - Down',
  'FP50 Eastern Saturday - Up',
  'FP50 Eastern Saturday - Down',
  'FP50 Eastern Sunday - Up',
  'FP50 Eastern Sunday - Down',

  'FP50 NESG All Days - Up',
  'FP50 NESG All Days - Down',

  'FP50 North Eastern Weekday - Up',
  'FP50 North Eastern Weekday - Down',
  'FP50 North Eastern Saturday - Up',
  'FP50 North Eastern Saturday - Down',
  'FP50 North Eastern Sunday - Up',
  'FP50 North Eastern Sunday - Down',

  'FP50 Northern Weekday - Up',
  'FP50 Northern Weekday - Down',
  'FP50 Northern Saturday - Up',
  'FP50 Northern Saturday - Down',
  'FP50 Northern Sunday - Up',
  'FP50 Northern Sunday - Down',

  'FP50 South Western Weekday - Up',
  'FP50 South Western Weekday - Down',
  'FP50 South Western Saturday - Up',
  'FP50 South Western Saturday - Down',
  'FP50 South Western Sunday - Up',
  'FP50 South Western Sunday - Down',

  'FP50 Western Weekday - Up',
  'FP50 Western Weekday - Down',
  'FP50 Western Saturday - Up',
  'FP50 Western Saturday - Down',
  'FP50 Western Sunday - Up',
  'FP50 Western Sunday - Down'
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
  'Marshall': 'Geelong',
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

  'Warrnambool': 'Warrnambool'
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
  let timetable = fs.readFileSync('vnet_timetables/' + filename + '.csv').toString()
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
      const stopName = stationMeta[0]
      const fieldContents = stationMeta[1]

      const stopData = await stops.findDocument({
        stopName: new RegExp('^' + stopName + ' railway station', 'i')
      })
      const bay = stopData.bays.filter(bay => bay.mode === 'regional train')[0];

      let arrivalTime = null; let departureTime = null
      if (!tripStops[stopName]) {
        tripStops[stopName] = {
          stopName: stopData.stopName,
          stopGTFSID: bay.stopGTFSID,
          arrivalTime: null,
          departureTime: null,
          platform: null,
          stopConditions: ""
        }
      }

      if (timing.includes('/')) {
        timing = timing.split('/')
        arrivalTime = timing[0]
        departureTime = timing[1]
        tripStops[stopName].arrivalTime = arrivalTime.slice(0, 5)
        tripStops[stopName].departureTime = departureTime.slice(0, 5)

        let stopConditions = departureTime.slice(5)
        return
      }

      if (timing.includes('*')) tripStops[stopName].express = true
      if (fieldContents === 'Arr') tripStops[stopName].arrivalTime = timing.slice(0, 5)
      else if (fieldContents === 'Dep') tripStops[stopName].departureTime = timing.slice(0, 5)
      else if (fieldContents === 'Plat') tripStops[stopName].platform = timing
      else {
        tripStops[stopName].arrivalTime = timing.slice(0, 5)
        tripStops[stopName].departureTime = timing.slice(0, 5)

        tripStops[stopName].stopConditions = timing.slice(5)
      }
    })

    let stopTimings = routeStops.map(name => tripStops[name]).filter(e => !e.express).filter(e => e.arrivalTime + e.departureTime !== '')

    const destination = stopTimings.slice(-1)[0].stopName
    const departureTime = stopTimings[0].departureTime
    const origin = stopTimings[0].stopName

    const l = stopTimings.length - 1
    stopTimings = stopTimings.map((stop, i) => {
      if (i === 0) stop.arrivalTime = null
      if (i === l) stop.departureTime = null
      stop.arrivalTimeMinutes = timingToMinutesAfterMidnight(stop.arrivalTime)
      stop.departureTimeMinutes = timingToMinutesAfterMidnight(stop.departureTime)

      return stop
    })

    const dest = destination.slice(0, -16)
    const originDest = `${origin.slice(0, -16)}-${dest}`
    const line = terminiToLines[originDest] || terminiToLines[origin.slice(0, -16)] || terminiToLines[dest]

    const key = {
      mode: "regional train",
      runID,
      operationDays,
      destination,
      departureTime,
      origin
    }
    const timetableData = {
      mode: "regional train",
      operator: "V/Line",
      lineName: line,
      runID,
      operationDays,
      vehicle,
      formedBy,
      forming,
      stopTimings,
      destination,
      departureTime,
      origin
    }

    if (await timetables.countDocuments(key)) {
      await timetables.updateDocument(key, {
        $set: timetableData
      })
    } else {
      await timetables.createDocument(timetableData)
    }
  })
}

database.connect({
  poolSize: 500
}, async err => {
  stops = database.getCollection('stops')
  timetables = database.getCollection('timetables')

  await async.map(files, async filename => {
    const csvData = await loadTimetableCSV(filename)
    await loadTrips(csvData)
    console.log('Completed ' + filename)
  })
  console.log('Completed loading in ' + timetableCount + ' VNET timetables')
  process.exit()
})
