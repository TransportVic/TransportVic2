import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }

export async function checkStop(stops, stopName, mode) {
 let dbStop = await stops.findDocument({ stopName })
  if (!dbStop) return { stop: stopName, reason: 'missing', mode }
  if (!dbStop.textQuery || !dbStop.textQuery.length)  return { stop: stopName, reason: 'missing-text-query', mode }
  if (!dbStop.bays.find(bay => bay.mode === mode)) return { stop: stopName, reason: 'missing-bay', mode }
  if (!dbStop.bays.find(bay => bay.mode === mode && bay.services.length && bay.screenServices.length)) return { stop: stopName, reason: 'missing-bay-services', mode }

  if (mode === 'tram') {
    if (!dbStop.bays.find(bay => bay.mode === mode && bay.tramTrackerID)) return { stop: stopName, reason: 'missing-tramtracker-id', mode }
  }

  if (mode === 'regional train') {
    if (!dbStop.bays.find(bay => bay.mode === mode && bay.vnetStationName)) return { stop: stopName, reason: 'missing-vnet-name', mode }
  }
}

export async function checkStopNumbers(stops, stopName, mode) {
  let dbStop = await stops.findDocument({ stopName })
  if (!dbStop.bays.find(bay => bay.mode === mode && bay.stopNumber)) return { stop: stopName, reason: 'missing-stop-number', mode }
}

export async function checkStops(db) {
  let stops = db.getCollection('stops')
  let testFailures = []

  for (let stopName of ['Flinders Street', 'Ringwood', 'Sunshine']) {
    testFailures.push(await checkStop(stops, stopName + ' Railway Station', 'metro train'))
  }

  for (let stopName of ['Southern Cross', 'Bendigo']) {
    testFailures.push(await checkStop(stops, stopName + ' Railway Station', 'regional train'))
  }

  for (let stopName of ['Monash University Bus Loop', 'Clifton Hill Interchange/Queens Parade', 'Horsham Town Centre/Roberts Avenue', 'Bairnsdale Hospital/Princes Highway', 'Melbourne Airport T1 Skybus/Arrival Drive']) {
    testFailures.push(await checkStop(stops, stopName, 'bus'))
  }
  testFailures.push(await checkStopNumbers(stops, 'Frankston Railway Station', 'bus'))

  for (let stopName of ['Melbourne University/Swanston Street', 'Clifton Hill Interchange/Queens Parade', 'Elsternwick Railway Station', 'Footscray Railway Station', 'Bourke Street Mall']) {
    testFailures.push(await checkStop(stops, stopName, 'tram'))
    testFailures.push(await checkStopNumbers(stops, stopName, 'tram'))
  }

  let failures = testFailures.filter(Boolean)
  if (failures.length) {
    return { status: 'fail', failures: failures }
  } else {
    return { status: 'ok' }
  }
}

export async function checkRoute(routes, query) {
  let routeData = await routes.findDocument({ ...query })
  if (!routeData) return { query, reason: 'missing' }
  if (!routeData.routePath.length) return { query, reason: 'missing-route-path', mode: routeData.mode }
  if (!routeData.directions.length) return { query, reason: 'missing-route-stops', mode: routeData.mode }
}

export async function checkRouteOperators(routes) {
  let missingOperatorRoutes = await routes.findDocuments({
    $or: [{
      operators: 'Unknown'
    }, {
      operators: []
    }]
  }).toArray()

  return missingOperatorRoutes.map(route => ({
    mode: route.mode, routeGTFSID: route.routeGTFSID,
    routeNumber: route.routeNumber, routeName: route.routeName
  })).sort((a, b) => a.routeGTFSID.localeCompare(b.routeGTFSID))
}

async function checkRoutes(db) {
  let routes = db.getCollection('routes')
  let testFailures = []

  let targetRoutes = [
    { routeGTFSID: '1-GEL', routeGTFSID: '2-PKM' }, { routeGTFSID: '3-67' }, { routeGTFSID: '4-630' }, { routeGTFSID: '5-BGO' },
    { routeGTFSID: '10-GSR' }, { routeGTFSID: '11-SKY' },
    { routeGTFSID: 'bus', routeNumber: '1', suburb: 'East Bairnsdale' } // TODO: Implement network region
  ]

  for (let route of targetRoutes) testFailures.push(await checkRoute(routes, route))

  let missingOperatorRoutes = await checkRouteOperators(routes)

  let failures = testFailures.filter(Boolean)
  if (failures.length || missingOperatorRoutes.length) {
    return { status: 'fail', failures: failures, missingOperatorRoutes }
  } else {
    return { status: 'ok' }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  console.log(await checkStops(mongoDB))
  console.log(await checkRoutes(mongoDB))

  process.exit(0)
}