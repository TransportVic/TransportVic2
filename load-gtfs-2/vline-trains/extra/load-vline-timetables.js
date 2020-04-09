const pdf2table = require('./pdf2table-vline')
const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')

const termini = require('./termini-to-lines')
const routeGTFSIDs = require('./route-gtfs-ids')

const {tableToColumnOrder, expandName} = require('./timetable-utils')

let stops, timetables

function operatingDaysToArray (days) {
  days = days.replace(/ /g, '').replace(/&/g, ',')
  let daysOfWeek = ['Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun']
  let dayMapping = {
    'M': 'Mon',
    'Tu': 'Tues',
    'W': 'Wed',
    'Th': 'Thur',
    'F': 'Fri',
    'Sat': 'Sat',
    'Sun': 'Sun',
    'Su': 'Sun'
  }

  if (days === 'Daily') return daysOfWeek
  if (daysOfWeek.includes(days)) return [days]
  if (days === 'MF') return daysOfWeek.slice(0, -2)

  let specialDays = days.slice(0, -1).match(/([A-Z][a-z]*)/g)
  if (days.includes('+')) {
    return days.split('+').map(day => dayMapping[day])
  } if (days.endsWith('O')) {
    return specialDays.map(day => dayMapping[day])
  } else if (days.endsWith('E')) {
    let excludedDays = specialDays.map(day => dayMapping[day])
    return daysOfWeek.slice(0, -2).filter(day => !excludedDays.includes(day))
  }

  throw Error('Unknown days ' + days)
}

let stationCache = {}
let nonStations = {}

async function parseTimings(names, types, trip) {
  let locations = {}

  let headers = trip.slice(0, 5).concat(trip.slice(-1))
  let timings = trip.slice(5, -1)

  let tripDivides = false
  let tripDividePoint = null

  let movementType = headers[4]
  if (movementType !== 'PSNG_SRV') return

  let offset = 0
  let previousTime = 0

  await async.forEachOfSeries(names.slice(5), async (locationName, i) => {
    let type = types[i + 5], timing = timings[i]
    if (!timing || timing.includes('…')) return
    timing = timing.replace('*', '')

    let stationData
    if (nonStations[locationName]) return
    if (stationCache[locationName]) stationData = stationCache[locationName]
    else {
      stationData = await stops.findDocument({
        bays: {
          $elemMatch: {
            mode: 'regional train',
            fullStopName: new RegExp(locationName + ' Railway Station', 'i')
          }
        }
      })

      if (stationData) {
        stationCache[locationName] = stationData
      } else {
        nonStations[locationName] = true
        return
      }
    }

    let stationPlatform = stationData.bays.find(bay => bay.mode === 'regional train')

    if (timing.includes('DV')) {
      tripDivides = true
      tripDividePoint = stationPlatform.fullStopName.slice(0, -16)
    }

    let minutesAftMidnight = utils.time24ToMinAftMidnight(timing) + offset
    if (!isNaN(minutesAftMidnight)) {
      if (previousTime > minutesAftMidnight) {
        offset += 1440
        minutesAftMidnight += offset
      }
      previousTime = minutesAftMidnight
    }

    if (timing.includes('*')) return

    let exists = !!locations[locationName]
    if (!exists)
      locations[locationName] = {
        stopName: stationPlatform.fullStopName,
        stopGTFSID: stationPlatform.stopGTFSID,
        arrivalTime: timing.slice(0, 5),
        arrivalTimeMinutes: minutesAftMidnight,
        departureTime: timing.slice(0, 5),
        departureTimeMinutes: minutesAftMidnight,
        platform: null,
        sortTime: minutesAftMidnight
      }

    if (timing.includes('/')) {
      let [arrivalTime, departureTime] = timing.split('/')
      let arrivalTimeMinutes = utils.time24ToMinAftMidnight(arrivalTime) + offset
      let departureTimeMinutes = utils.time24ToMinAftMidnight(departureTime) + offset

      locations[locationName].arrivalTime = arrivalTime
      locations[locationName].arrivalTimeMinutes = arrivalTimeMinutes
      locations[locationName].departureTime = departureTime
      locations[locationName].departureTimeMinutes = departureTimeMinutes
    }

    if (type) {
      if (type === 'Dep') {
        locations[locationName].departureTime = timing.slice(0, 5)
        locations[locationName].departureTimeMinutes = minutesAftMidnight
      }
      if (type === 'Plat') {
        locations[locationName].platform = timing.trim()
      }
    }
  })

  let stopTimings = Object.values(locations).filter(stop => !isNaN(stop.arrivalTimeMinutes))

  let vehicleFormation = headers[2],
    formedBy = headers[3],
    forms = headers[5]

  let lastStop = stopTimings.slice(-1)[0]

  let destination = lastStop.stopName.slice(0, -16)
  let origin = stopTimings[0].stopName.slice(0, -16)
  let originDest = `${origin}-${destination}`
  let line = termini[originDest] || termini[origin] || termini[destination]
  let routeGTFSID = routeGTFSIDs[line]

  stopTimings[0].arrivalTime = null
  stopTimings[0].arrivalTimeMinutes = null
  lastStop.departureTime = null
  lastStop.departureTimeMinutes = null

  return {
    mode: 'regional train',
    routeName: line,
    routeGTFSID,
    runID: headers[0].replace(/†/g, '').trim(),
    operationDays: operatingDaysToArray(headers[1]),
    vehicle: vehicleFormation,
    formedBy,
    forming: forms,
    operator: 'V/Line',
    stopTimings,
    origin: origin + ' Railway Station',
    departureTime: stopTimings[0].departureTime,
    destination: destination + ' Railway Station',
    destinationArrivalTime: lastStop.arrivalTime,
    flags: {
      tripDivides,
      tripDividePoint
    }
  }
}

function readFileData(filename, allTrips, callback) {
  fs.readFile(path.join(__dirname, 'timetables', filename), async (err, buffer) => {
    if (err) return console.log(err)

    let pages = await pdf2table.parse(buffer)

    pages = pages.map(page => {
      let headers = page.slice(0, 5)
      let timings = page.slice(5)

      let currentStation
      timings = timings.map(row => {
        if (row[0] === '') {
          row = [currentStation, ...row.slice(1)]
        } else {
          currentStation = row[0]
        }
        return row
      })
      return [...headers, ...timings]
    })
    pages = pages.map(tableToColumnOrder)

    let trips = (await async.mapSeries(pages, async page => {
      return await async.mapSeries(page.slice(2).filter(trip => trip[0].trim().length), async trip => {
        return await parseTimings(page[0].map(expandName), page[1], trip)
      })
    })).reduce((acc, page) => acc.concat(page), [])

    trips.forEach(trip => {
      if (!trip) return

      let upService = !(trip.runID[3] % 2)
      trip.direction = upService ? 'Up' : 'Down'

      let tripID = trip.runID + trip.operationDays.join('-')
      if (allTrips[tripID]) {
        let locationsSeen = allTrips[tripID].stopTimings.map(l => l.stopName.toLowerCase())
        trip.stopTimings.forEach(tripTiming => {
          let name = tripTiming.stopName.toLowerCase()
          if (!locationsSeen.includes(name)) {
            locationsSeen.push(name)
            allTrips[tripID].stopTimings.push(tripTiming)
          }
        })

        allTrips[tripID].stopTimings = allTrips[tripID].stopTimings
          .sort((a, b) => a.sortTime - b.sortTime)
          .map(a => {
            delete a.sortTime
            return a
          })
      } else allTrips[tripID] = trip
    })

    callback(allTrips)
  })
}

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')
  timetables = database.getCollection('timetables')

  await timetables.deleteDocuments({ mode: 'regional train' })

  let trips = {}
  let files = fs.readdirSync(path.join(__dirname, 'timetables'))

  await async.forEachSeries(files, async filename => {
    await new Promise(resolve => {
      readFileData(filename, trips, newTrips => {
        trips = newTrips
        resolve()
      })
    })
  })

  trips = Object.values(trips)

  await timetables.bulkWrite(trips.map(trip => ({
    insertOne: trip
  })))

  console.log('Completed loading in ' + trips.length + ' V/Line WTT passenger trips')
  process.exit()
})
