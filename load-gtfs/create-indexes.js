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

  let liveTimetables = database.getCollection('live timetables')
  let vlineTrips = database.getCollection('vline trips')
  let smartrakIDs = database.getCollection('smartrak ids')
  let busTrips = database.getCollection('bus trips')
  let tbmTrips = database.getCollection('tbm trips')

  await stops.createIndex({
    stopName: 1,
    'bays.stopGTFSID': 1
  }, {unique: true, name: 'stops index'})

  await stops.createIndex({
    'location': '2dsphere',
  }, {name: 'stops location index'})

  await stops.createIndex({
    'bays.mode': 1,
    'bays.stopGTFSID': 1
  }, {name: 'mode+gtfs id index'})

  await stops.createIndex({
    'bays.stopGTFSID': 1
  }, {name: 'just stop gtfs id index'})

  await stops.createIndex({
    'mergeName': 1
  }, {name: 'merge name index'})

  await stops.createIndex({
    'bays.fullStopName': 1,
    'stopName': 1
  }, {name: 'search index'})

  await stops.createIndex({
    'suburb': 1
  }, {name: 'suburb index'})

  await stops.createIndex({
    'codedSuburb': 1,
    'codedName': 1
  }, {name: 'coded suburb index'})

  await stops.createIndex({
    'namePhonetic': 1
  }, {name: 'phonetic name index'})

  await stops.createIndex({
    'tramTrackerNames': 1
  }, {name: 'tramtracker name index', sparse: true})

  await stops.createIndex({
    'tramTrackerIDs': 1
  }, {name: 'tramtracker id index', sparse: true})

  await stops.createIndex({
    'bays.stopNumber': 1
  }, {name: 'stop number index'})

  await stops.createIndex({
    'bays.vnetStationName': 1
  }, {name: 'vnet station name index', sparse: true})

  await stops.createIndex({
    'bays.flags.tramtrackerName': 1,
    'bays.flags.services': 1
  }, {name: 'tramtracker name + services index', sparse: true})


  console.log('Created stops indices')

  await routes.createIndex({
    routeName: 1
  }, {name: 'route name index'})

  await routes.createIndex({
    routeNumber: 1
  }, {name: 'route number index'})

  await routes.createIndex({
    routeGTFSID: 1
  }, {name: 'route gtfs id index', unique: true})

  console.log('Created route indices')

  await gtfsTimetables.createIndex({
    mode: 1,
    routeName: 1,
    routeGTFSID: 1,
    operationDays: 1,
    destination: 1,
    origin: 1,
    departureTime: 1,
    destination: 1,
    destinationArrivalTime: 1,
    tripID: 1,
    shapeID: 1
  }, {unique: true, name: 'gtfs timetable index'})

  await gtfsTimetables.createIndex({
    shapeID: 1
  }, {name: 'shapeID index'})

  await gtfsTimetables.createIndex({
    operationDays: 1,
    routeGTFSID: 1,
  }, {name: 'operationDays + routeGTFSID index'})

  await gtfsTimetables.createIndex({
    routeGTFSID: 1,
    mode: 1,
    destination: 1,
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1
  }, {name: 'mode+routeGTFSID index'})

  await gtfsTimetables.createIndex({
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1
  }, {name: 'stop timings gtfs index'})

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
    operationDays: 1
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
  }, {unique: true, name: 'live timetable index'})

  await liveTimetables.createIndex({
    operationDays: 1
  }, {name: 'operationDays index'})

  await liveTimetables.createIndex({
    mode: 1,
    routeGTFSID: 1,
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1
  }, {name: 'stop timings gtfs index'})


  await vlineTrips.createIndex({
    date: 1,
    runID: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1,
    consist: 1
  }, {name: 'vline trips index', unique: 1})

  await vlineTrips.createIndex({
    date: 1,
    consist: 1
  }, {name: 'consist index'})

  await vlineTrips.createIndex({
    consist: 1
  }, {name: 'undated consist index'})

  await vlineTrips.createIndex({
    set: 1
  }, {name: 'set index', sparse: 1})

  console.log('Created live timetables index')


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
  }, {name: 'service operating days + smartrak id query index'})

  console.log('Created bus trips index')

  await tbmTrips.createIndex({
    date: 1,
    rego: 1,
    tripName: 1,
    time: 1
  }, {name: 'tbm trips'})

  console.log('Created tourbusminder index')

  updateStats('create-indexes', 35)
  process.exit()
})
