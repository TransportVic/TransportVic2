import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'
import config from '../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import LiveTimetable from '../schema/live-timetable.js'

async function getStopFromVNetName(stops, vnetName) {
  return await stops.findDocument({
    'bays.vnetStationName': vnetName
  })
}

export async function matchTrip(operationDay, vlineTrip, db) {
  let gtfsTimetables = await db.getCollection('gtfs timetables')
  let stops = await db.getCollection('stops')

  let originStop = await getStopFromVNetName(stops, vlineTrip.origin)
  let destinationStop = await getStopFromVNetName(stops, vlineTrip.destination)

  if (!originStop || !destinationStop) return null

  return await gtfsTimetables.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: operationDay,
    origin: originStop.stopName,
    destination: destinationStop.stopName,
    departureTime: utils.formatPTHHMM(utils.parseTime(vlineTrip.departureTime.toUTC().toISO())),
    destinationArrivalTime: utils.formatPTHHMM(utils.parseTime(vlineTrip.arrivalTime.toUTC().toISO())),
  })
}

export async function downloadTripPattern(operationDay, vlineTrip, db) {
  let tripPattern = await vlineTrip.getStoppingPattern()
  let gtfsTimetables = await db.getCollection('gtfs timetables')
  let stops = await db.getCollection('stops')
  let routes = await db.getCollection('routes')

  let bestOrigin = null, bestDestination = null
  for (let i = 0; i < tripPattern.length; i++) {
    bestOrigin = await getStopFromVNetName(stops, tripPattern[i].location)
    if (bestOrigin) break
  }

  for (let i = tripPattern.length - 1; i >= 0; i++) {
    bestDestination = await getStopFromVNetName(stops, tripPattern[i].location)
    if (bestDestination) break
  }

  // None of the stops matched, the trip is either garbage or the database broke
  if (!bestOrigin || !bestDestination) return null 

  let matchingRoute = await routes.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    $and: [{
      'directions.stops.stopName': bestOrigin.stopName
    }, {
      'directions.stops.stopName': bestDestination.stopName
    }]
  })

  // No route matched the trip
  if (!matchingRoute) return null

  let timetable = new LiveTimetable(
    GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDay,
    matchingRoute.routeName,
    null,
    matchingRoute.routeGTFSID,
  )

  timetable.logChanges = false
  timetable.runID = vlineTrip.tdn
  timetable.direction = vlineTrip.direction

  for (let stop of tripPattern) {
    let stopData = await getStopFromVNetName(stops, stop.location)
    let vlineBay = stopData.bays.find(bay => bay.stopType === 'station')
    timetable.updateStopByName(stopData.stopName, {
      stopGTFSID: vlineBay.stopGTFSID,
      suburb: vlineBay.suburb,
      scheduledDepartureTime: new Date(stop.departureTime.toUTC().toISO()),
    })
  }

  return timetable
}

export default async function loadOperationalTT(db, operationDay, ptvAPI) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await loadOperationalTT(mongoDB, utils.now(), ptvAPI)

await mongoDB.close()
}
