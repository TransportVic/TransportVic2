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
  let metroNotify = await getCollection('metro notify')
  let metroShunts = await getCollection('metro shunts')
  let metroLocations = await getCollection('metro locations')

  let metroLogger = await getCollection('metro logs')

  let csrfTokens = await getCollection('csrf tokens')

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
    'textQuery': 'text'
  }, {name: 'text index'})

  await stops.createIndex({
    'codedSuburb': 1,
    'codedName': 1
  }, {name: 'coded suburb index'})

  await stops.createIndex({
    'codedName': 1
  }, {name: 'coded name index'})

  await stops.createIndex({
    'codedNames': 1
  }, {name: 'coded names index'})

  await stops.createIndex({
    'namePhonetic': 1,
    _id: 1
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

  await stops.createIndex({
    'bays.originalName': 1
  }, {name: 'original name index'})

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

  await routes.createIndex({
    operators: 1,
    routeGTFSID: 1
  }, {name: 'operator index'})

  await routes.createIndex({
    'routePath.path': '2dsphere'
  }, {name: 'path geospatial index'})

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
    tripID: 1
  }, {name: 'tripID index'})

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
    destination: 1,
    direction: 1
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

  await gtfsTimetables.createIndex({
    mode: 1,
    operationDays: 1,
    routeName: 1
  }, {name: 'vline trip matching'})

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

  await timetables.createIndex({
    mode: 1,
    operationDays: 1,
    routeGTFSID: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    direction: 1
  }, {name: 'trip matching index'})

  await timetables.createIndex({
    mode: 1,
    'stopTimings.stopName': 1,
    'stopTimings.departureTimeMinutes': 1,
    'stopTimings.arrivalTimeMinutes': 1
  }, {name: 'vline matching index'})

  console.log('Created static timetable indexes')

  await liveTimetables.createIndex({
    mode: 1,
    routeName: 1,
    routeGTFSID: 1,
    operationDays: 1,
    runID: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1
  }, {name: 'live timetable index', unique: true})

  await liveTimetables.createIndex({
    tripID: 1
  }, {name: 'tripID index'})

  await liveTimetables.createIndex({
    operationDays: 1
  }, {name: 'operationDays index'})

  await liveTimetables.createIndex({
    operationDays: 1,
    trueDepartureTime: 1,
    trueOrigin: 1,
    trueDestinationArrivalTime: 1,
    trueDestination: 1
  }, {name: 'metro index', sparse: true})

  await liveTimetables.createIndex({
    runID: 1,
    mode: 1,
    operationDays: 1
  }, {name: 'runID index', sparse: true})

  await liveTimetables.createIndex({
    operationDays: 1,
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1,
    mode: 1,
    routeGTFSID: 1,
    destination: 1,
    direction: 1
  }, {name: 'stop timings live index'})

  await liveTimetables.createIndex({
    'stopTimings.stopGTFSID': 1,
    'stopTimings.actualDepartureTimeMS': 1,
    mode: 1,
    trueDestination: 1
  }, {name: 'live stop timings index'})

  await liveTimetables.createIndex({
    mode: 1,
    'stopTimings.actualDepartureTimeMS': 1,
  }, {name: 'active trip index'})

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
    consist: 1,
    date: 1
  }, {name: 'consist index'})

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
    tram: 1,
    date: 1,
    routeNumber: 1
  }, {name: 'tram index'})

  await tramTrips.createIndex({
    routeNumber: 1,
    date: 1,
    tram: 1
  }, {name: 'route operating days'})

  await tramTrips.createIndex({
    shift: 1,
    date: 1,
    tram: 1
  }, {name: 'shift index'})

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
    destinationArrivalTime: 1
  }, {name: 'trip index', unique: true})

  await busTrips.createIndex({
    smartrakID: 1,
    date: 1,
    routeNumber: 1
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

  await metroNotify.createIndex({
    alertID: 1
  }, { name: 'alertid index', unique: true })

  await metroNotify.createIndex({
    active: 1,
    alertID: 1
  }, { name: 'active index' })

  await metroNotify.createIndex({
    fromDate: 1,
    toDate: 1,
    routeName: 1
  }, { name: 'date index' })

  await metroNotify.createIndex({
    toDate: 1,
    fromDate: 1
  }, { name: 'date index 2' })

  await metroNotify.createIndex({
    active: 1,
    toDate: 1,
    type: 1
  }, { name: 'suspensions index' })

  console.log('Created Metro Notify index')

  await metroShunts.createIndex({
    date: 1,
    runID: 1,
    routeName: 1
  }, { name: 'metro shunts index', unique: 1 })

  await metroShunts.createIndex({
    date: 1,
    station: 1
  }, { name: 'metro shunts by station' })

  await metroShunts.createIndex({
    date: 1,
    routeName: 1,
    runID: 1
  }, { name: 'metro shunts by route' })

  console.log('Created Metro Shunts index')

  await metroLocations.createIndex({
    consist: 1,
    timestamp: 1
  }, { name: 'metro locations index', unique: 1 })

  console.log('Created Metro Shunts index')

  await metroLogger.createIndex({
    utc: 1,
    referer: 1,
    ip: 1,
    userAgent: 1
  }, { name: 'metro logger index', unique: 1 })

  console.log('Created Metro Logger index')

  await csrfTokens.createIndex({
    created: 1,
    ip: 1,
    uses: 1,
    _id: 1
  }, { name: 'csrf index', unique: 1 })

  console.log('Created CSRF Token index')

  updateStats('create-indexes', 71)
  process.exit()
})
