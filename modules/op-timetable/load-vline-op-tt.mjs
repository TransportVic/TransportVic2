import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'
import config from '../../config.json' with { type: 'json' }
import { GetPlatformServicesAPI, PTVAPI, PTVAPIInterface, VLineAPIInterface } from '@transportme/ptv-api'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import { LiveTimetable } from '../schema/live-timetable.mjs'
import VLineUtils from '../vline/vline-utils.mjs'
import VLineTripUpdater from '../vline/trip-updater.mjs'
import discordIntegration from '../discord-integration.js'
import { getDSTMinutesPastMidnight, getNonDSTMinutesPastMidnight, isDSTChange } from '../dst/dst.js'
import fs from 'fs/promises'
import { hostname } from 'os'

let existingVNetStops = {}

async function getStopFromVNetName(stops, vnetName) {
  if (existingVNetStops[vnetName]) return existingVNetStops[vnetName]

  let stop = await stops.findDocument({
    'bays.vnetStationName': vnetName
  })
  existingVNetStops[vnetName] = stop
  return stop
}

export async function matchTrip(opDayFormat, operationDay, vlineTrip, db) {
  let gtfsTimetables = await db.getCollection('gtfs timetables')

  let stops = await db.getCollection('stops')
  let originStop = await getStopFromVNetName(stops, vlineTrip.origin)
  let destinationStop = await getStopFromVNetName(stops, vlineTrip.destination)

  if (!originStop || !destinationStop) return null

  let arrivalTime = utils.parseTime(vlineTrip.arrivalTime.toUTC().toISO())
  let departureTime = utils.parseTime(vlineTrip.departureTime.toUTC().toISO())
  
  // Really crappy DST aware + midnight handling code :D
  let isBeforeDSTChangeDay = isDSTChange(operationDay.clone().add(1, 'day'))
  let departureTimeMinutes = isBeforeDSTChangeDay ? getDSTMinutesPastMidnight(departureTime) : getNonDSTMinutesPastMidnight(departureTime)
  let arrivalTimeMinutes = isBeforeDSTChangeDay ? getDSTMinutesPastMidnight(arrivalTime) : getNonDSTMinutesPastMidnight(arrivalTime)

  if (departureTime.get('hour') < 3) {
    departureTimeMinutes += 1440
    arrivalTimeMinutes += 1440
  } else if (arrivalTime.get('hour') < 3) {
    arrivalTimeMinutes += 1440
  }

  const baseQuery = {
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: opDayFormat,
    $and: [{
      stopTimings: {
        $elemMatch: {
          stopName: originStop.stopName,
          departureTimeMinutes: {
            $gte: departureTimeMinutes - 20,
            $lte: departureTimeMinutes + 20,
          },
        }
      }
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: destinationStop.stopName,
          arrivalTimeMinutes: {
            $gte: arrivalTimeMinutes - 20,
            $lte: arrivalTimeMinutes + 20
          }
        }
      }
    }]
  }

  return await gtfsTimetables.findDocument({
    ...baseQuery,
    runID: vlineTrip.tdn
  }) || await gtfsTimetables.findDocument(baseQuery)
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
  if ([bestOrigin.stopName, bestDestination.stopName].includes('Maryborough Railway Station')) matchingRoute = await routes.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    routeGTFSID: '1-MBY'
  })
  if ([bestOrigin.stopName, bestDestination.stopName].includes('Ararat Railway Station')) matchingRoute = await routes.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    routeGTFSID: '1-ART'
  })
  if ([bestOrigin.stopName, bestDestination.stopName].includes('Ballarat Railway Station')) matchingRoute = await routes.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    routeGTFSID: '1-BAT'
  })
  if ([bestOrigin.stopName, bestDestination.stopName].includes('Wendouree Railway Station')) matchingRoute = await routes.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    routeGTFSID: '1-BAT'
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

async function updateExistingTrip(db, tripDB, existingTrip, vlineTrip) {
  let stops = db.getCollection('stops')
  let originStop = await getStopFromVNetName(stops, vlineTrip.origin)
  let destinationStop = await getStopFromVNetName(stops, vlineTrip.destination)

  if (!originStop || !destinationStop) return null

  await VLineTripUpdater.updateTripOriginDestination(
    db, tripDB, existingTrip.operationDays, existingTrip.runID,
    originStop.stopName, destinationStop.stopName, 'vline-op-tt'
  )

  let originOffset = vlineTrip.departureTime - new Date(existingTrip.stopTimings[0].scheduledDepartureTime)
  let destinationOffset = vlineTrip.arrivalTime - new Date(existingTrip.stopTimings[existingTrip.stopTimings.length - 1].scheduledDepartureTime)
  if (originOffset !== 0 && Math.abs(originOffset - destinationOffset) <= 5 * 60 * 1000) {
    await VLineTripUpdater.setTripTimeOffset(
      db, tripDB, existingTrip.operationDays, existingTrip.runID,
      originOffset, 'vline-op-tt'
    )
  }
}

export default async function loadOperationalTT(db, tripDB, operationDay, ptvAPI) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let dayOfWeek = utils.getDayOfWeek(operationDay) // Technically should use public holiday thing
  let liveTimetables = db.getCollection('live timetables')

  let outputTrips = []

  let departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 1440)
  let arrivals = await ptvAPI.vline.getArrivals('', GetPlatformServicesAPI.BOTH, 1440)
  let newTrips = []

  let tripsNeedingFetch = []

  for (let vlineTrip of departures.concat(arrivals).filter(trip => trip.origin && trip.destination)) {
    let existingTrip = await VLineTripUpdater.getTripByTDN(liveTimetables, vlineTrip.tdn, opDayFormat)
    if (existingTrip) {
      await updateExistingTrip(db, tripDB, existingTrip, vlineTrip)
      continue
    }

    let matchingTrip = await matchTrip(opDayFormat, operationDay, vlineTrip, db)
    let nspTrip = await VLineUtils.getNSPTrip(dayOfWeek, vlineTrip.tdn, db)

    if (matchingTrip) {
      let liveTrip = convertToLive(matchingTrip, operationDay)
      liveTrip.runID = vlineTrip.tdn
      liveTrip.direction = vlineTrip.direction
      if (nspTrip) {
        liveTrip.formedBy = nspTrip.formedBy
        liveTrip.forming = nspTrip.forming
      }

      newTrips.push({ liveTrip, vlineTrip })

      outputTrips.push({
        replaceOne: {
          filter: { mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain, operationDays: opDayFormat, runID: liveTrip.runID },
          replacement: liveTrip,
          upsert: true
        }
      })
      continue
    }
    tripsNeedingFetch.push({ opDayFormat, vlineTrip, nspTrip })
  }

  let missingTrips = tripsNeedingFetch.slice(15)
  for (let { opDayFormat, vlineTrip, nspTrip } of tripsNeedingFetch.slice(0, 15)) {
    let pattern = await downloadTripPattern(opDayFormat, vlineTrip, nspTrip, db)
    if (!pattern) {
      missingTrips.push({ vlineTrip })
      continue
    }

    outputTrips.push({
      replaceOne: {
        filter: pattern.getDBKey(),
        replacement: pattern.toDatabase(),
        upsert: true
      }
    })
  }

  if (outputTrips.length) await liveTimetables.bulkWrite(outputTrips)
  await Promise.all(newTrips.map(({ liveTrip, vlineTrip }) => updateExistingTrip(db, tripDB, liveTrip, vlineTrip)))

  return missingTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `V/Line Op TT: ${hostname()} loading`)

  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  let vlineAPIInterface = new VLineAPIInterface(config.vlineCallerID, config.vlineSignature)
  ptvAPI.addVLine(vlineAPIInterface)

  let opDay = utils.now()
  if (opDay.get('hours') < 3) opDay.add(-1, 'day')

  const missingTrips = await loadOperationalTT(database, tripDatabase, opDay, ptvAPI)
  if (missingTrips.length) {
    const tripData = `Missing V/Line trips (${missingTrips.length}):\n` + missingTrips.map(
      ({ vlineTrip }) => `TD${vlineTrip.tdn}: ${vlineTrip.departureTime.toFormat('HH:mm')} ${vlineTrip.origin} - ${vlineTrip.destination}`
    ).join('\n')
    console.log(tripData)

    await discordIntegration('vlineOpTT', tripData)
  }

  await discordIntegration('taskLogging', `V/Line Op TT: ${hostname()} completed loading`)

  await database.close()
  await tripDatabase.close()
}
