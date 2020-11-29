const pdf2table = require('./pdf2table-vline')
const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')

const termini = require('../../../additional-data/termini-to-lines')
const routeGTFSIDs = require('./route-gtfs-ids')

const {tableToColumnOrder, expandName} = require('./timetable-utils')
const updateStats = require('../../utils/stats')

let stops, timetables
let bendigoRFRSection = ['Woodend', 'Macedon', 'Gisborne', 'Riddells Creek', 'Clarkefield']

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

  let isConditional = headers[0].includes('†')
  let runID = headers[0].replace(/[†+]/g, '').trim()
  let upService = !(runID[3] % 2)

  let tripDivides = false
  let tripDividePoint = null

  let tripAttaches = false
  let tripAttachPoint = null

  let movementType = headers[4]
  let vehicleFormation = headers[2]
  let formedBy = headers[3]

  if (movementType !== 'PSNG_SRV') return

  let offset = 0
  let previousTime = 0

  let lastLocation

  let formsIndex = names.indexOf('Forms')

  await async.forEachOf(names.slice(5, formsIndex), async (locationName, i) => {
    let type = types[i + 5], timing = timings[i]

    if (locationName === 'Seymour Standard Gauge Platform') locationName = 'Seymour'
    if (locationName === 'Clarkefield (New Code)') locationName = 'Clarkefield'
    if (locationName === 'Riddels Creek') locationName = 'Riddells Creek'

    if (['Arr', 'Dep', 'Plat'].includes(locationName)) {
      type = locationName
      locationName = lastLocation
    } else lastLocation = locationName

    let stationData
    if (nonStations[locationName]) return
    if (stationCache[locationName]) stationData = stationCache[locationName]
    else {
      stationData = await stops.findDocument({
        bays: {
          $elemMatch: {
            mode: {
              $in: ['regional train', 'regional coach']
            },
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

    if (!timing || timing.includes('…')) return
    let isExpress = timing.includes('*')
    timing = timing.replace('*', '')

    let stationPlatform = stationData.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000) // We don't want to assign to the NSW stop
    if (!stationPlatform) stationPlatform = stationData.bays.find(bay => bay.mode === 'regional train') // Loosen a bit
    if (!stationPlatform) stationPlatform = stationData.bays.find(bay => bay.mode === 'regional coach') // Fallback to coach because the whole albury line is missing now

    if (timing.includes('DV')) {
      tripDivides = true
      tripDividePoint = stationPlatform.fullStopName.slice(0, -16)
    }

    if (timing.includes('AV')) {
      tripAttaches = true
      tripAttachPoint = stationPlatform.fullStopName.slice(0, -16)
    }

    let minutesAftMidnight = utils.getMinutesPastMidnightFromHHMM(timing) + offset
    if (!isNaN(minutesAftMidnight)) {
      if (previousTime > minutesAftMidnight) {
        offset += 1440
        minutesAftMidnight += offset
      }
      previousTime = minutesAftMidnight
    }

    if (timing.includes('*')) return

    let exists = !!locations[locationName]
    if (!exists) {
      locations[locationName] = {
        stopName: stationPlatform.fullStopName,
        stopGTFSID: stationPlatform.stopGTFSID,
        suburb: stationPlatform.suburb,
        arrivalTime: timing.slice(0, 5),
        arrivalTimeMinutes: minutesAftMidnight,
        departureTime: timing.slice(0, 5),
        departureTimeMinutes: minutesAftMidnight,
        platform: null,
        track: null,
        sortTime: minutesAftMidnight,
        express: isExpress
      }
    }

    if (timing.includes('/')) {
      let [arrivalTime, departureTime] = timing.split('/').map(x => x.slice(0, 5))
      let arrivalTimeMinutes = utils.getMinutesPastMidnightFromHHMM(arrivalTime) + offset
      let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime) + offset

      locations[locationName].arrivalTime = arrivalTime
      locations[locationName].arrivalTimeMinutes = arrivalTimeMinutes
      locations[locationName].departureTime = departureTime
      locations[locationName].departureTimeMinutes = departureTimeMinutes
    }

    if (type) {
      if (type === 'Dep') {
        locations[locationName].departureTime = timing.slice(0, 5)
        locations[locationName].departureTimeMinutes = minutesAftMidnight
      } else if (type === 'Plat') {
        if (locations[locationName].platform) { // because plat is already filled this would be track
          locations[locationName].track = timing.trim()
        } else {
          locations[locationName].platform = timing.trim()
        }

      }
    } else if (timing.length === 1) {
      locations[locationName].track = timing.trim()
    }
  })

  let stopTimings = Object.values(locations).filter(stop => !isNaN(stop.arrivalTimeMinutes))

  if (stopTimings[0].departureTimeMinutes < 180) {
    stopTimings.forEach(stop => {
      if (stop.departureTimeMinutes) stop.departureTimeMinutes += 1440
      if (stop.arrivalTimeMinutes) stop.arrivalTimeMinutes += 1440
      stop.sortTime += 1440
    })
  }

  let formingData = trip.slice(-2)
  let forming
  if (formingData[1] === 'OFF') forming = 'OFF'
  else if (formingData[1].startsWith('DAP')) {
    forming = formingData[1].slice(4).split(', ').map(e => (e.replace(',', '')))
  } else {
    if (formingData[0].length === 4) {
      forming = [formingData[0]]
    } else {
      forming = [formingData[1]]
    }
  }

  return {
    movementType,
    runID,
    operationDays: operatingDaysToArray(headers[1]),
    vehicle: vehicleFormation,
    isConditional,
    formedBy,
    forming,
    stopTimings,
    flags: {
      tripDivides,
      tripDividePoint,
      tripAttaches,
      tripAttachPoint
    },
    direction: upService ? 'Up' : 'Down'
  }
}

function readFileData(filename, allTrips, callback) {
  fs.readFile(path.join(__dirname, 'timetables', filename), async (err, buffer) => {
    if (err) return console.log(err)

    let pages = await pdf2table.parse(buffer)

    pages = pages.map(page => {
      let form = page.find(x => {
        let lower = x[0].toLowerCase()
        return lower.includes('movement') || lower.includes('formed')
      })

      let sliceEnd = page.indexOf(form) + 1
      let next = page[sliceEnd]
      if(next[0].toLowerCase().includes('movement')) sliceEnd++

      let headers = page.slice(0, sliceEnd)
      let timings = page.slice(sliceEnd)

      let currentStation
      timings = timings.map(row => {
        if (row[0] === '') {
          row = [currentStation, ...row.slice(1)]
        } else {
          currentStation = row[0]
        }
        return row
      })

      if (sliceEnd === 5) return [...headers, ...timings]
      if (sliceEnd === 4) return [...headers, '', ...timings]
    })

    pages = pages.map(tableToColumnOrder)

    let trips = (await async.mapSeries(pages, async page => {
      let pages = page.slice(2).filter(trip => trip[0].trim().length)
      return await async.mapSeries(page.slice(2).filter(trip => trip[0].trim().length), async (trip, i) => {
        let currentHead = trip.slice(0, 6)
        let tripBody = trip.slice(5)
        let tripToUse = trip
        if (!tripBody.find(t => t.trim())) {
          tripToUse = currentHead.concat(pages[i + 1].slice(5))
        }

        return await parseTimings(page[0].map(expandName), page[1], tripToUse)
      })
    })).reduce((acc, page) => acc.concat(page), [])

    trips.forEach(trip => {
      if (!trip) return
      let tripID = trip.runID + trip.operationDays.join('-')
      if (allTrips[tripID]) {
        let locationsSeen = allTrips[tripID].stopTimings.map(l => l.stopName.toLowerCase())

        trip.stopTimings.forEach(tripTiming => {
          let name = tripTiming.stopName.toLowerCase()
          if (!locationsSeen.includes(name)) {
            locationsSeen.push(name)
            allTrips[tripID].stopTimings.push(tripTiming)
          } else {
            let existing = allTrips[tripID].stopTimings.find(l => l.stopName.toLowerCase() === name)
            existing.platform = existing.platform || tripTiming.platform
            existing.track = existing.track || tripTiming.track
          }
        })

        allTrips[tripID].stopTimings = allTrips[tripID].stopTimings.sort((a, b) => a.sortTime - b.sortTime)
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

  trips = Object.values(trips).map(trip => {
    let gisborne = trip.stopTimings.find(stop => stop.stopName === 'Gisborne Railway Station')

    if (gisborne) {
      let platform = gisborne.track === 'W' ? '2' : '1'
      trip.stopTimings = trip.stopTimings.map(stop => {
        if (bendigoRFRSection.includes(stop.stopName.slice(0, -16))) {
          stop.platform = platform
        }

        return stop
      })
    }

    let stopTimings = trip.stopTimings
    let lastStop = stopTimings.slice(-1)[0]

    stopTimings[0].arrivalTime = null
    stopTimings[0].arrivalTimeMinutes = null
    lastStop.departureTime = null
    lastStop.departureTimeMinutes = null

    return {
      ...trip,
      origin: stopTimings[0].stopName,
      departureTime: stopTimings[0].departureTime,
      destination: lastStop.stopName,
      destinationArrivalTime: lastStop.arrivalTime
    }
  })

  await timetables.bulkWrite(trips.map(trip => ({
    insertOne: trip
  })))

  updateStats('vline-static-timetables', trips.length)
  console.log('Completed loading in ' + trips.length + ' V/Line WTT passenger trips')
  process.exit()
})
