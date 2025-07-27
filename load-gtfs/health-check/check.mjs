import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import fs from 'fs/promises'
import path from 'path'
import discordIntegration from '../../modules/discord-integration.js'

const FAILURE_TEXTS = {
  'missing-stop': 'Missing Stop',
  'missing-text-query': 'Missing Text Query (Searching)',
  'missing-bay': 'Missing Stop Bay',
  'missing-bay-services': 'Missing Stop Bay Services',
  'missing-tramtracker-id': 'Missing TramTracker Data',
  'missing-vnet-data': 'Missing VNet Data',
  'missing-stop-number': 'Missing Stop Number',

  'missing-route': 'Missing Route',
  'missing-route-path': 'Missing Route Path',
  'missing-route-stops': 'Missing Route Stops',
}

export async function checkStop(stops, stopName, mode) {
 let dbStop = await stops.findDocument({ stopName })
  if (!dbStop) return { stop: stopName, reason: 'missing-stop', mode }
  if (!dbStop.textQuery || !dbStop.textQuery.length)  return { stop: stopName, reason: 'missing-text-query', mode }
  if (!dbStop.bays.find(bay => bay.mode === mode)) return { stop: stopName, reason: 'missing-bay', mode }
  if (!dbStop.bays.find(bay => bay.mode === mode && bay.services.length && bay.screenServices.length)) return { stop: stopName, reason: 'missing-bay-services', mode }

  if (mode === 'tram') {
    if (!dbStop.bays.find(bay => bay.mode === mode && bay.tramTrackerID)) return { stop: stopName, reason: 'missing-tramtracker-id', mode }
  }

  if (mode === 'regional train') {
    if (!dbStop.bays.find(bay => bay.mode === mode && bay.vnetStationName)) return { stop: stopName, reason: 'missing-vnet-data', mode }
  }
}

export async function checkStopNumbers(stops, stopName, mode) {
  let dbStop = await stops.findDocument({ stopName })
  if (!dbStop) return
  if (!dbStop.bays.find(bay => bay.mode === mode && bay.stopNumber)) return { stop: stopName, reason: 'missing-stop-number', mode }
}

export async function checkStops(db) {
  let stops = db.getCollection('stops')
  let testFailures = []

  for (let stopName of ['Flinders Street', 'Ringwood', 'Sunshine']) {
    testFailures.push(await checkStop(stops, stopName + ' Railway Station', 'metro train'))
  }

  for (let stopName of ['Southern Cross', 'Bendigo', 'Geelong', 'Ballan']) {
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
  if (!routeData) return { query, reason: 'missing-route' }
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
    { routeGTFSID: '1-GEL' }, { routeGTFSID: '2-PKM' }, { routeGTFSID: '3-67' }, { routeGTFSID: '4-630' }, { routeGTFSID: '5-BGO' },
    { routeGTFSID: '10-GSR' }, { routeGTFSID: '11-SKY' },
    { mode: 'bus', routeNumber: '1', region: 'Bairnsdale' },
    { mode: 'bus', routeNumber: '3', region: 'Lakes Entrance' },
    { mode: 'bus', routeNumber: '83', region: 'Warragul' },
    { mode: 'bus', routeNumber: '433', region: 'Bacchus Marsh' },
    { mode: 'bus', routeNumber: '401', region: 'Wangaratta' },
    { mode: 'bus', routeNumber: '1', region: 'Castlemaine' },
    { mode: 'bus', routeNumber: '5', region: 'Horsham' }
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
  const config = JSON.parse(await fs.readFile(path.join(fileURLToPath(import.meta.url), '../../../config.json')))
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let output = []

  let stopCheck = await checkStops(mongoDB)
  let routeCheck = await checkRoutes(mongoDB)

  if (stopCheck.status === 'ok') output.push('Stop Data: OK ✅')
  else {
    output.push('Stop Data: Fail ❌')
    output.push('Failing Stops:')
    output.push(...stopCheck.failures.map(failure => `${failure.stop} (${failure.mode}): ${FAILURE_TEXTS[failure.reason]}`))
  }
  
  output.push('')
  
  if (routeCheck.status === 'ok') output.push('Route Data: OK ✅')
  else {
    output.push('Route Data: Fail ❌')
    output.push('Failing Routes:')
    output.push(...routeCheck.failures.map(failure => {
      let prettyQuery = Object.keys(failure.query).map(key => `${key}: '${failure.query[key]}'`).join(', ')
      return `{ ${prettyQuery} }${failure.mode ? ` (${failure.mode})` : ''}: ${FAILURE_TEXTS[failure.reason]}`
    }))

    if (routeCheck.missingOperatorRoutes.length > 20) {
      output.push('More than 20 routes missing operator data, further investigation needed')
    } else {
      output.push(...routeCheck.missingOperatorRoutes.map(failure => {
        return `(${failure.routeGTFSID} ${failure.mode}): ${failure.routeName} ${failure.routeNumber || ''}`
      }))
    }
  }

  let outputText = output.join('\n')
  console.log(outputText)
  await discordIntegration('gtfsHealthCheck', outputText)

  process.exit(0)
}