const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')

const updateStats = require('./utils/stats')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function getCollection(name) {
  try {
    return await database.createCollection(name)
  } catch (e) {
    return database.getCollection(name)
  }
}

database.connect({
  poolSize: 100
}, async err => {
  let stops = await getCollection('stops')
  let routes = await getCollection('routes')
  let timetables = await getCollection('timetables')
  let gtfsTimetables = await getCollection('gtfs timetables')

  let liveTimetables = await getCollection('live timetables')
  let metroTrips = await getCollection('metro trips')
  let vlineTrips = await getCollection('vline trips')
  let tramTrips = await getCollection('tram trips')
  let smartrakIDs = await getCollection('smartrak ids')
  let busTrips = await getCollection('bus trips')
  let tbmTrips = await getCollection('tbm trips')

  await stops.createIndex({
    stopName: 1,
    'bays.stopGTFSID': 1
  }, {unique: true, name: 'stops index'})

  await stops.createIndex({
    'location': '2dsphere',
    mergeName: 1
  }, {name: 'stops location index'})

  await stops.createIndex({
    'bays.mode': 1,
    'bays.stopGTFSID': 1
  }, {name: 'mode+gtfs id index'})

  await stops.createIndex({
    'bays.stopGTFSID': 1
  }, {name: 'just stop gtfs id index'})

  await stops.createIndex({
    '$**': 'text'
  }, {name: 'text index'})

  await stops.createIndex({
    'codedSuburb': 1,
    'codedName': 1
  }, {name: 'coded suburb index'})

  await stops.createIndex({
    'namePhonetic': 1
  }, {name: 'phonetic name index'})

  await stops.createIndex({
    'bays.tramTrackerID': 1
  }, {name: 'tramtracker id index'})

  await stops.createIndex({
    'bays.stopNumber': 1
  }, {name: 'stop number index'})

  await stops.createIndex({
    'bays.vnetStationName': 1
  }, {name: 'vnet station name index', sparse: true})

  await stops.createIndex({
    'bays.fullStopName': 1
  }, {name: 'ptv matching index 1'})

  console.log('Created stops indexes')

  await routes.createIndex({
    routeName: 1
  }, {name: 'route name index'})

  await routes.createIndex({
    routeNumber: 1
  }, {name: 'route number index'})

  await routes.createIndex({
    routeGTFSID: 1
  }, {name: 'route gtfs id index', unique: true})

  console.log('Created route indexes')

  await gtfsTimetables.createIndex({
    routeGTFSID: 1,
    operationDays: 1,
    destination: 1,
    origin: 1,
    departureTime: 1,
    destinationArrivalTime: 1,
    tripID: 1 // Ideally tripID wouldn't be included but there's duplicate trips in the dataset so...
  }, {name: 'gtfs timetable index', unique: true})

  await gtfsTimetables.createIndex({
    shapeID: 1
  }, {name: 'shapeID index'})

  await gtfsTimetables.createIndex({
    gtfsMode: 1
  }, {name: 'gtfs mode index'})

  await gtfsTimetables.createIndex({
    runID: 1
  }, {name: 'runID index', sparse: true})

  await gtfsTimetables.createIndex({
    operationDays: 1,
    routeGTFSID: 1
  }, {name: 'operationDays + routeGTFSID index'})

  await gtfsTimetables.createIndex({
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1,
    mode: 1,
    routeGTFSID: 1,
    destination: 1
  }, {name: 'stop timings gtfs index'})

  await gtfsTimetables.createIndex({
    mode: 1,
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1
  }, {name: 'stop services index'})

  await gtfsTimetables.createIndex({
    routeGTFSID: 1,
    gtfsDirection: 1
  }, {name: 'directions index'})

  await gtfsTimetables.createIndex({
    mode: 1,
    operationDays: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1
  }, {name: 'run lookup index'})

  console.log('Created GTFS timetables indexes')

  await timetables.createIndex({
    mode: 1,
    operationDays: 1,
    runID: 1,
    origin: 1,
    destination: 1
  }, {name: 'timetable index', unique: true})

  await timetables.createIndex({
    runID: 1,
    operationDays: 1,
    destination: 1
  }, {name: 'runID index', unique: true})

  await timetables.createIndex({
    origin: 1,
    direction: 1,
    'stopTimings.stopName': 1,
    'stopTimings.departureTimeMinutes': 1
  }, {name: 'connections index'})

  console.log('Created static timetable indexes')

  await liveTimetables.createIndex({
    mode: 1,
    routeName: 1,
    routeGTFSID: 1,
    operationDays: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1
  }, {name: 'live timetable index', unique: true})

  await liveTimetables.createIndex({
    operationDays: 1
  }, {name: 'operationDays index'})

  await liveTimetables.createIndex({
    runID: 1
  }, {name: 'runID index', sparse: true})

  await liveTimetables.createIndex({
    'stopTimings.stopGTFSID': 1,
    'stopTimings.actualDepartureTimeMS': 1,
    mode: 1
  }, {name: 'live stop timings index'})

  console.log('Created live timetables index')

  await metroTrips.createIndex({
    date: 1,
    runID: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1
  }, {name: 'metro trips index', unique: true})

  await metroTrips.createIndex({
    date: 1,
    consist: 1
  }, {name: 'consist index'})

  await metroTrips.createIndex({
    consist: 1
  }, {name: 'undated consist index'})

  console.log('Created metro trips index')

  await vlineTrips.createIndex({
    date: 1,
    runID: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1
  }, {name: 'vline trips index', unique: true})

  await vlineTrips.createIndex({
    date: 1,
    consist: 1
  }, {name: 'consist index'})

  await vlineTrips.createIndex({
    consist: 1
  }, {name: 'undated consist index'})

  await vlineTrips.createIndex({
    set: 1
  }, {name: 'set index', sparse: true})

  console.log('Created vline trips index')

  await tramTrips.createIndex({
    date: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1
  }, {name: 'tram trips index', unique: true})

  await tramTrips.createIndex({
    date: 1,
    tram: 1
  }, {name: 'tram index'})

  await tramTrips.createIndex({
    tram: 1
  }, {name: 'undated tram index'})

  console.log('Created tram trips index')

  await smartrakIDs.createIndex({
    smartrakID: 1
  }, {name: 'smartrak id index', unique: true})

  await smartrakIDs.createIndex({
    fleetNumber: 1
  }, {name: 'fleet number index', unique: true})

  await smartrakIDs.createIndex({
    operator: 1
  }, {name: 'operator index'})

  console.log('Created smartrak IDs index')

  await busTrips.createIndex({
    date: 1,
    routeGTFSID: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1,
    smartrakID: 1
  }, {name: 'trip index', unique: true})

  await busTrips.createIndex({
    smartrakID: 1,
    date: 1
  }, {name: 'smartrak id index'})

  await busTrips.createIndex({
    routeNumber: 1,
    date: 1,
    smartrakID: 1
  }, {name: 'route operating days + smartrak id query index'})

  await busTrips.createIndex({
    routeGTFSID: 1,
    date: 1,
    smartrakID: 1
  }, {name: 'route gtfs id operating days + smartrak id query index'})

  console.log('Created bus trips index')

  await tbmTrips.createIndex({
    date: 1,
    rego: 1,
    tripName: 1,
    time: 1
  }, {name: 'tbm trips'})

  console.log('Created tourbusminder index')

  updateStats('create-indexes', 42)
  process.exit()
})
