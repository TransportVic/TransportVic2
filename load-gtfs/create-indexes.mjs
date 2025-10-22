import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }

let mainDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mainDB.connect()

async function createStopIndex(mongoStops) {
  await mongoStops.createIndex({
    'location': '2dsphere',
    mergeName: 1
  }, {name: 'stops location index'})

  await mongoStops.createIndex({
    'bays.stopGTFSID': 1
  }, {name: 'stops id index'})

  await mongoStops.createIndex({
    'bays.mode': 1
  }, {name: 'stops bay mode index'})

  await mongoStops.createIndex({
    stopName: 1
  }, {name: 'stops name index'})

  await mongoStops.createIndex({
    textQuery: 'text'
  }, {name: 'text query index'})

  await mongoStops.createIndex({
    textQuery: 1
  }, {name: 'text query binary index'})

  await mongoStops.createIndex({
    cleanSuburbs: 1,
    cleanName: 1
  }, {name: 'clean stops name index'})

  await mongoStops.createIndex({
    cleanName: 1
  }, {name: 'clean name index'})

  await mongoStops.createIndex({
    cleanNames: 1
  }, {name: 'clean names index'})

  await mongoStops.createIndex({
    'bays.tramTrackerID': 1
  }, {name: 'tramtracker id index', sparse: true})

  await mongoStops.createIndex({
    'bays.stopNumber': 1
  }, {name: 'stop number index'})

  await mongoStops.createIndex({
    'bays.vnetStationName': 1
  }, {name: 'vnet station name index', sparse: true})

  await mongoStops.createIndex({
    'bays.fullStopName': 1
  }, {name: 'ptv matching index 1'})

  await mongoStops.createIndex({
    'bays.originalName': 1
  }, {name: 'original name index'})
}

async function createRouteIndex(mongoRoutes) {
  await mongoRoutes.createIndex({
    routeGTFSID: 1
  }, {name: 'route id index'})

  await mongoRoutes.createIndex({
    routeName: 1
  }, {name: 'route name index'})

  await mongoRoutes.createIndex({
    routeNumber: 1
  }, {name: 'route number index'})

  await mongoRoutes.createIndex({
    operators: 1,
    routeGTFSID: 1
  }, {name: 'operator index'})

  await mongoRoutes.createIndex({
    'routePath.path': '2dsphere'
  }, {name: 'path geospatial index'})

  await mongoRoutes.createIndex({
    mode: 1,
    routeNumber: 1,
    'routePath.path': '2dsphere'
  }, {name: 'specific path geospatial index'})

  await mongoRoutes.createIndex({
    'directions.stops.suburb': 1
  }, {name: 'route suburb index'})
}

async function createTimetableIndex(mongoTimetables) {
  await mongoTimetables.createIndex({
    mode: 1,
    routeGTFSID: 1
  }, {name: 'route id index'})

  await mongoTimetables.createIndex({
    'stopTimings.stopGTFSID': 1,
    'stopTimings.stopConditions.pickup': 1,
    mode: 1
  }, {name: 'stop services index'})

  await mongoTimetables.createIndex({
    tripID: 1
  }, {name: 'trip id index'})

  await mongoTimetables.createIndex({
    routeGTFSID: 1,
    shapeID: 1
  }, {name: 'shape id index'})

  await mongoTimetables.createIndex({
    operationDays: 1,
    runID: 1,
    mode: 1
  }, {name: 'runID index', sparse: true})

  await mongoTimetables.createIndex({
    mode: 1,
    'stopTimings.stopGTFSID': 1,
    'stopTimings.departureTimeMinutes': 1,
    routeGTFSID: 1,
    destination: 1
  }, {name: 'stop timings index'})

  await mongoTimetables.createIndex({
    mode: 1,
    operationDays: 1,
    origin: 1,
    destination: 1,
    departureTime: 1,
    destinationArrivalTime: 1
  }, {name: 'run lookup index'})
}

async function createMetroTripIndex(metroTrips) {
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
    runID: 1
  }, {name: 'metro trips index (runID only)', unique: true})

  await metroTrips.createIndex({
    consist: 1,
    date: 1
  }, {name: 'consist index'})
}

async function createVLineTripIndex(vlineTrips) {
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
}

async function createTramTripIndex(tramTrips) {
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
}

async function createBusTripIndex(busTrips) {
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

  await busTrips.createIndex({
    consist: 1,
    date: 1
  })

  await busTrips.createIndex({
    routeNumber: 1,
    date: 1,
    consist: 1
  })
}

async function createSmartrakIndex(smartrakIDs) {
  await smartrakIDs.createIndex({
    smartrakID: 1
  }, {name: 'smartrak id index', unique: true})

  await smartrakIDs.createIndex({
    fleetNumber: 1
  }, {name: 'fleet number index', unique: true})

  await smartrakIDs.createIndex({
    operator: 1
  }, {name: 'operator index'})
}

async function createBusRegoIndex(busRegos) {
  await busRegos.createIndex({
    rego: 1
  }, {name: 'bus rego index', unique: true})

  await busRegos.createIndex({
    fleetNumber: 1
  }, {name: 'fleet number index', unique: true})

  await busRegos.createIndex({
    operator: 1
  }, {name: 'operator index'})
}

async function createMetroNotifyIndex(metroNotify) {
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
}

async function createMetroLocationsIndex(metroLocations) {
  await metroLocations.createIndex({
    consist: 1,
    timestamp: 1
  }, { name: 'metro locations index', unique: 1 })
}

async function createLiveTimetableIndex(liveTimetables) {
  await liveTimetables.createIndex({
    'stopTimings.stopGTFSID': 1,
    'stopTimings.actualDepartureTimeMS': 1,
    mode: 1,
    destination: 1
  }, {name: 'live stop timings index'})

  await liveTimetables.createIndex({
    mode: 1,
    'stopTimings.actualDepartureTimeMS': 1,
  }, {name: 'active trip index'})

  await liveTimetables.createIndex({
    operationDays: 1
  })

  await liveTimetables.createIndex({
    mode: 1,
    runID: 1,
    'stopTimings.scheduledDepartureTime': 1,
    'stopTimings.stopGTFSID': 1,
  }, {name: 'metro live trip index', sparse: true})

  await liveTimetables.createIndex({
    operationDays: 1,
    mode: 1,
    'changes.timestamp': 1,
    'changes.type': 1,
  }, {name: 'metro live change index', sparse: true})

  await liveTimetables.createIndex({
    lastUpdated: 1,
    'stopTimings.actualDepartureTimeMS': 1,
  }, {name: 'last updated index', sparse: true})

  await liveTimetables.createIndex({
    mode: 1,
    operationDays: 1,
    runID: 1
  }, {name: 'metro live trip index (TDN index)', unique: true, sparse: true})
}

await createStopIndex(await mainDB.getCollection('gtfs-stops'))
await createRouteIndex(await mainDB.getCollection('gtfs-routes'))
await createTimetableIndex(await mainDB.getCollection('gtfs-gtfs timetables'))
await createTimetableIndex(await mainDB.getCollection('gtfs-timetables'))

await createStopIndex(await mainDB.getCollection('stops'))
await createRouteIndex(await mainDB.getCollection('routes'))
await createTimetableIndex(await mainDB.getCollection('gtfs timetables'))
await createTimetableIndex(await mainDB.getCollection('timetables'))

await createTimetableIndex(await mainDB.getCollection('live timetables'))
await createLiveTimetableIndex(await mainDB.getCollection('live timetables'))
await createMetroTripIndex(await mainDB.getCollection('metro trips'))
await createVLineTripIndex(await mainDB.getCollection('vline trips'))
await createTramTripIndex(await mainDB.getCollection('tram trips'))
await createBusTripIndex(await mainDB.getCollection('bus trips'))
await createSmartrakIndex(await mainDB.getCollection('smartrak ids'))
await createBusRegoIndex(await mainDB.getCollection('bus regos'))
await createMetroNotifyIndex(await mainDB.getCollection('metro notify'))
await createMetroLocationsIndex(await mainDB.getCollection('metro locations'))

console.log('Created indexes')

process.exit(0)