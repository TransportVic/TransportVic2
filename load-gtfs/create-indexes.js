const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')

const updateStats = require('./utils/stats')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')
  let timetables = database.getCollection('timetables')
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let liveTimetables = database.getCollection('live timetables')
  let vlineTrips = database.getCollection('vline trips')

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
    'bays.stopGTFSID': 1,
    'bays.mode': 1
  }, {name: 'gtfs id+mode index'})

  await stops.createIndex({
    'bays.fullStopName': 1
  }, {name: 'full name index'})

  await stops.createIndex({
    'suburb': 1,
    'stopName': 1,
  }, {name: 'search index'})

  await stops.createIndex({
    'codedSuburb': 1
  }, {name: 'coded suburb index'})

  await stops.createIndex({
    'codedName': 1
  }, {name: 'coded name index'})

  await stops.createIndex({
    'stopName': 1
  }, {name: 'stopName index'})

  await stops.createIndex({
    'mergeName': 1
  }, {name: 'mergeName index'})

  await stops.createIndex({
    'tramTrackerIDs': 1
  }, {name: 'tramtracker id index', sparse: true})

  await stops.createIndex({
    'tramTrackerNames': 1
  }, {name: 'tramtracker name index', sparse: true})

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
  }, {name: 'operationDays + routeGTFSID + start stop times index'})

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

  await gtfsTimetables.createIndex({
    gtfsMode: 1
  }, {name: 'gtfs mode index'})

  await gtfsTimetables.createIndex({
    routeGTFSID: 1,
    gtfsDirection: 1
  }, {name: 'route direction index'})

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
    destination: 1
  }, {name: 'destination index'})

  await liveTimetables.createIndex({
    mode: 1,
    routeGTFSID: 1
  }, {name: 'mode/routeGTFSID index'})

  await liveTimetables.createIndex({
    operationDays: 1
  }, {name: 'operationDays index'})

  await liveTimetables.createIndex({
    stopTimings: 1,
  }, {name: 'timings index'})

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

  console.log('Created live timetables index')

  updateStats('create-indexes', 36)
  process.exit()
})
