import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'
import config from '../../config.json' with { type: 'json' }
import { GetPlatformServicesAPI, PTVAPI, PTVAPIInterface, VLineAPIInterface } from '@transportme/ptv-api'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import LiveTimetable from '../schema/live-timetable.js'
import VLineUtils from '../vline/vline-utils.mjs'
import VLineTripUpdater from '../vline/trip-updater.mjs'

let existingVNetStops = {}

async function getStopFromVNetName(stops, vnetName) {
  if (existingVNetStops[vnetName]) return existingVNetStops[vnetName]

  let stop = await stops.findDocument({
    'bays.vnetStationName': vnetName
  })
  existingVNetStops[vnetName] = stop
  return stop
}

export async function matchTrip(operationDay, vlineTrip, db) {
  let gtfsTimetables = await db.getCollection('gtfs timetables')
  let stops = await db.getCollection('stops')

  let originStop = await getStopFromVNetName(stops, vlineTrip.origin)
  let destinationStop = await getStopFromVNetName(stops, vlineTrip.destination)

  if (!originStop || !destinationStop) return null

  let arrivalTime = utils.parseTime(vlineTrip.arrivalTime.toUTC().toISO())
  return await gtfsTimetables.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: operationDay,
    origin: originStop.stopName,
    destination: destinationStop.stopName,
    departureTime: utils.formatPTHHMM(utils.parseTime(vlineTrip.departureTime.toUTC().toISO())),
    destinationArrivalTime: {
      $in: [
        utils.formatPTHHMM(arrivalTime.clone().add(-1, 'minute')),
        utils.formatPTHHMM(arrivalTime),
        utils.formatPTHHMM(arrivalTime.clone().add(1, 'minute')),
      ]
    }
  })
}

async function deduplicateStops(tripPattern, nspTrip, db) {
  let stops = await db.getCollection('stops')

  let previousStop = tripPattern[0].location, hasDuplicates = false
  for (let i = 1; i < tripPattern.length; i++) {
    if (tripPattern[i].location === previousStop) {
      hasDuplicates = true
      break
    }
  }

  if (!hasDuplicates || !nspTrip) return tripPattern

  let nspTimes = {}
  for (let stop of nspTrip.stopTimings) {
    nspTimes[stop.stopName] = (stop.departureTime || stop.arrivalTime)
  }

  let outputTrip = []
  for (let i = 0; i < tripPattern.length; i++) {
    let tripStop = tripPattern[i]
    let stopData = await getStopFromVNetName(stops, tripStop.location)
    let tripStopTime = utils.formatPTHHMM(utils.parseTime(tripStop.arrivalTime.toUTC().toISO()))

    if (nspTimes[stopData.stopName] === tripStopTime) continue
    outputTrip.push(tripStop)
  }

  return outputTrip
}

export async function downloadTripPattern(operationDay, vlineTrip, nspTrip, db) {
  let tripPattern = await vlineTrip.getStoppingPattern()
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

  let updatedTrip = await deduplicateStops(tripPattern, nspTrip, db)

  for (let stop of updatedTrip) {
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

async function updateExistingTrip(db, existingTrip, vlineTrip) {
  let stops = db.getCollection('stops')
  let originStop = await getStopFromVNetName(stops, vlineTrip.origin)
  let destinationStop = await getStopFromVNetName(stops, vlineTrip.destination)

  if (!originStop || !destinationStop) return null

  await VLineTripUpdater.updateTripOriginDestination(
    db, existingTrip.operationDays, existingTrip.runID,
    originStop.stopName, destinationStop.stopName
  )

  let originOffset = vlineTrip.departureTime - new Date(existingTrip.stopTimings[0].scheduledDepartureTime)
  let destinationOffset = vlineTrip.arrivalTime - new Date(existingTrip.stopTimings[existingTrip.stopTimings.length - 1].scheduledDepartureTime)
  if (originOffset !== 0 && originOffset === destinationOffset) {
    await VLineTripUpdater.setTripTimeOffset(
      db, existingTrip.operationDays, existingTrip.runID,
      originOffset
    )
  }
}

export default async function loadOperationalTT(db, operationDay, ptvAPI) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let dayOfWeek = utils.getDayOfWeek(operationDay) // Technically should use public holiday thing
  let liveTimetables = db.getCollection('live timetables')

  let outputTrips = []

  let departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 1440)
  let arrivals = await ptvAPI.vline.getArrivals('', GetPlatformServicesAPI.BOTH, 1440)

  for (let vlineTrip of departures.concat(arrivals)) {
    let existingTrip = await VLineTripUpdater.getTripByTDN(liveTimetables, vlineTrip.tdn, opDayFormat)
    if (existingTrip) {
      await updateExistingTrip(db, existingTrip, vlineTrip)
      continue
    }

    let matchingTrip = await matchTrip(opDayFormat, vlineTrip, db)
    let nspTrip = await VLineUtils.getNSPTrip(dayOfWeek, vlineTrip.tdn, db)

    if (matchingTrip) {
      let liveTrip = convertToLive(matchingTrip, operationDay)
      liveTrip.runID = vlineTrip.tdn
      liveTrip.direction = vlineTrip.direction
      if (nspTrip) {
        liveTrip.formedBy = nspTrip.formedBy
        liveTrip.forming = nspTrip.forming
      }

      outputTrips.push({
        replaceOne: {
          filter: { mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain, operationDays: opDayFormat, runID: liveTrip.runID },
          replacement: liveTrip,
          upsert: true
        }
      })
      continue
    }

    let pattern = await downloadTripPattern(opDayFormat, vlineTrip, nspTrip, db)
    if (!pattern) continue

    outputTrips.push({
      replaceOne: {
        filter: pattern.getDBKey(),
        replacement: pattern.toDatabase(),
        upsert: true
      }
    })
  }

  await liveTimetables.bulkWrite(outputTrips)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  let vlineAPIInterface = new VLineAPIInterface(config.vlineCallerID, config.vlineSignature)
  ptvAPI.addVLine(vlineAPIInterface)

  await loadOperationalTT(mongoDB, utils.now(), ptvAPI)

  await mongoDB.close()
}
