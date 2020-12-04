const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const loadRoutes = require('../../utils/load-routes')
const loadStops = require('../../utils/load-stops')
const loadGTFSTimetables = require('../../utils/load-gtfs-timetables')
const utils = require('../../../utils')
const turf = require('@turf/turf')
const gtfsUtils = require('../../../gtfs-utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../../utils/stats')
const timetables = require('./timetables')

let stopsURL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSRbKz9g8MveSiSnqQwfXpTCBzq_1z2gkjS5W4y6nj5QIgmZXjTg8fmKhaMzkfZbkUWGjIe1Uj8yMFm/pub?gid=0&single=true&output=csv'

function generateStopID(stopName) {
  return 13000000 + parseInt(parseInt(utils.hash(stopName), '16').toString().slice(2, 8))
}

let points = [
  [144.966391, -37.818419],
  [144.964799, -37.818860]
]

let length = turf.length({type: "LineString", coordinates: points}, { units: 'kilometers' }) * 1000

let shapes = [{
  shapeID: '13-MLH-mjp-1.1.H', // Down
  routeGTFSID: '13-MLH',
  path: points,
  length
}, {
  shapeID: '13-MLH-mjp-1.1.R', // Up
  routeGTFSID: '13-MLH',
  path: [
    points[1], points[0]
  ],
  length
}]

async function fetchStops() {
  let rawStopData = await utils.request(stopsURL)
  let rawStops = rawStopData.split('\r\n').slice(1).map(line => line.split(','))

  let allStops = rawStops.map(stop => {
    let name = stop[0] + ' Railway Station'

    return {
      originalName: `${name} (${stop[0]})`,
      fullStopName: name,
      stopGTFSID: generateStopID(name),
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(stop[2]),
          parseFloat(stop[1])
        ]
      },
      stopNumber: null,
      mode: 'heritage train',
      suburb: stop[0]
    }
  })

  console.log('Fetched', allStops.length, 'stops')
  return allStops
}

async function loadRouteData() {
  let routeData = [[ '13-MLH-mjp-1', '', '', 'Mainline Heritage Tours', '', '', 'FFFFFF' ]]

  await loadRoutes(database.getCollection('routes'), '13', routeData, shapes, () => {
    return ['Heritage']
  })

  console.log('Loaded mainline heritage route')
}

function getStopsRequired() {
  let stopsRequired = []
  timetables.timings.forEach(trip => {
    trip.stopTimings.forEach(stop => {
      if (!stopsRequired.includes(stop.stopName)) stopsRequired.push(stop.stopName)
    })
  })

  return stopsRequired
}

async function loadStopData(stops) {
  let stopNamesRequired = getStopsRequired()
  let stopsRequired = stops.filter(stop => stopNamesRequired.includes(stop.fullStopName.slice(0, -16)))
  let found = stopsRequired.map(stop => stop.fullStopName.slice(0, -16))
  let missing = stopNamesRequired.filter(stop => !found.includes(stop))

  let dbStops = database.getCollection('stops')

  let fromMissing = await async.map(missing, async stopName => {
    let dbStop = await dbStops.findDocument({
      stopName: stopName + ' Railway Station'
    })

    if (!dbStop) console.log('Could not identify', stopName)

    let bay = dbStop.bays.find(bay => bay.mode === 'regional train')
      || dbStop.bays.find(bay => bay.mode === 'metro train')

    if (!bay) console.log('Could not identify', stopName)

    return {
      originalName: bay.originalName,
      fullStopName: bay.fullStopName,
      stopGTFSID: generateStopID(bay.fullStopName),
      location: bay.location,
      stopNumber: null,
      mode: 'heritage train',
      suburb: bay.suburb
    }
  })

  let toInsert = [...stopsRequired, ...fromMissing]
  await loadStops(dbStops, toInsert, {})
  console.log('Loaded', toInsert.length, 'mainline heritage stops')

  return toInsert
}

database.connect({
  poolSize: 100
}, async err => {
  let stops = await fetchStops()
  await loadRouteData()
  let allStops = await loadStopData(stops)

  let stopLookup = {}
  allStops.forEach(stop => stopLookup[stop.fullStopName.slice(0, -16)] = stop.stopGTFSID)

  let mappedTimings = timetables.timings.map(timing => {
    timing.stopTimings = timing.stopTimings.map(stop => {
      stop.stopGTFSID = stopLookup[stop.stopName]
      return stop
    })

    return timing
  })

  let gtfsTimetables = database.getCollection('gtfs timetables')

  await gtfsTimetables.deleteDocuments({ gtfsMode: 13 })
  await loadGTFSTimetables({
    gtfsTimetables,
    stops: database.getCollection('stops'),
    routes: database.getCollection('routes')
  }, 13, timetables.trips, mappedTimings, timetables.days, timetables.dates)

  console.log('Loaded', timetables.trips.length, 'timetables')

  await updateStats('mainline-heritage-data', 0)
  process.exit()
})
