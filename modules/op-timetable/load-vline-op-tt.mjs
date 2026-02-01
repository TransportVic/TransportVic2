import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../utils.mjs'
import convertToLive from '../departures/sch-to-live.mjs'
import config from '../../config.json' with { type: 'json' }
import { GetPlatformServicesAPI, PTVAPI, PTVAPIInterface, StubVLineAPI, VLineAPIInterface } from '@transportme/ptv-api'
import { dateUtils, GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import { LiveTimetable } from '../schema/live-timetable.mjs'
import VLineUtils from '../vline/vline-utils.mjs'
import VLineTripUpdater from '../vline/trip-updater.mjs'
import { getDSTMinutesPastMidnight, getNonDSTMinutesPastMidnight, isDSTChange } from '../dst/dst.mjs'
import fs from 'fs/promises'
import { getLogPath } from '../../init-loggers.mjs'
import discordIntegration from '../discord-integration.mjs'

class PartialStubVLineAPI extends StubVLineAPI {

  #trueInterface

  constructor(callerID, signature) {
    super()
    this.#trueInterface = new VLineAPIInterface(callerID, signature)
  }

  async init() {
    const responsePath = getLogPath('vline-op-tt.xml')
    const data = (await fs.readFile(responsePath)).toString()

    this.setResponses([ data, '' ])

    return this
  }

  performFetch(apiMethod, requestOptions) {
    if (this.responses.length) return super.performFetch(apiMethod, requestOptions)
    return this.#trueInterface.performFetch(apiMethod, requestOptions)
  }

}

let existingVNetStops = {}

async function getStopFromVNetName(stops, vnetName) {
  if (existingVNetStops[vnetName]) return existingVNetStops[vnetName]

  let stop = await stops.findDocument({
    'bays.vnetStationName': vnetName
  })
  existingVNetStops[vnetName] = stop
  return stop
}

async function getScheduledTripByTDN(opDayFormat, vlineTrip, db) {
  let gtfsTimetables = await db.getCollection('gtfs timetables')
  return await gtfsTimetables.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: opDayFormat,
    runID: vlineTrip.tdn
  })
}

export async function matchTrip(opDayFormat, operationDay, vlineTrip, db, timetables, threshold=20) {
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

  if (arrivalTimeMinutes - departureTimeMinutes < 10) threshold = 3

  const baseQuery = {
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: opDayFormat,
    $and: [{
      stopTimings: {
        $elemMatch: {
          stopName: originStop.stopName,
          departureTimeMinutes: {
            $gte: departureTimeMinutes - threshold,
            $lte: departureTimeMinutes + threshold,
          },
        }
      }
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: destinationStop.stopName,
          arrivalTimeMinutes: {
            $gte: arrivalTimeMinutes - threshold,
            $lte: arrivalTimeMinutes + threshold
          }
        }
      }
    }]
  }

  return await timetables.findDocument({
    ...baseQuery,
    runID: vlineTrip.tdn
  }) || await timetables.findDocument(baseQuery)
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

async function findMatchingTrip(opDay, opDayFormat, scheduledTDN, vlineTrip, db) {
  const gtfsTimetables = await db.getCollection('gtfs timetables')
  const tripLength = vlineTrip.arrivalTime.diff(vlineTrip.departureTime, 'minutes').get('minutes')

  const tripStops = scheduledTDN.stopTimings.map(stop => stop.stopGTFSID)
  const matchingTripID = await gtfsTimetables.aggregate([{
    $match: {
      mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
      operationDays: opDayFormat,
      $and: tripStops.map(stopGTFSID => ({ 'stopTimings.stopGTFSID': stopGTFSID }))
    }
  }, {
    $project: {
      originStop: {
        $arrayElemAt: [
          {
              $filter: {
              input: "$stopTimings",
              as: "stopTimings",
              cond: { $eq: ["$$stopTimings.stopGTFSID", scheduledTDN.stopTimings[0].stopGTFSID] }
            }
          }, 0
        ]
      },
      destinationStop: {
        $arrayElemAt: [
          {
            $filter: {
              input: "$stopTimings",
              as: "stopTimings",
              cond: { $eq: ["$$stopTimings.stopGTFSID", scheduledTDN.stopTimings[scheduledTDN.stopTimings.length - 1].stopGTFSID] }
            }
          }, 0
        ]
      }
    }
  }, {
    $project: {
      tripLengthCloseness: {
        $abs: {
          $subtract: [
            { $subtract: ['$destinationStop.arrivalTimeMinutes', '$originStop.departureTimeMinutes'] },
            tripLength
          ]
        }
      }
    }
  }, {
    $match: {
      tripLengthCloseness: {
        $lte: 3
      }
    }
  }, {
    $sort: {
      tripLengthCloseness: 1
    }
  }]).limit(1).toArray()

  if (matchingTripID.length === 0) return null

  const matchingTrip = await gtfsTimetables.findDocument({ _id: matchingTripID[0]._id })
  const tripOffset = matchingTrip.stopTimings[0].departureTimeMinutes - scheduledTDN.stopTimings[0].departureTimeMinutes

  const timetable = new LiveTimetable(
    GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    opDayFormat,
    scheduledTDN.routeName,
    null,
    scheduledTDN.routeGTFSID,
    scheduledTDN.tripID
  )

  timetable.logChanges = false
  timetable.runID = vlineTrip.tdn
  timetable.direction = vlineTrip.direction
  timetable.gtfsDirection = scheduledTDN.gtfsDirection
  timetable.isRRB = false
  
  for (const stop of matchingTrip.stopTimings) {
    if (!tripStops.includes(stop.stopGTFSID)) continue

    const stopTime = stop.departureTimeMinutes - tripOffset
    timetable.updateStopByName(stop.stopName, {
      stopGTFSID: stop.stopGTFSID,
      stopNumber: null,
      suburb: stop.suburb,
      scheduledDepartureTime: opDay.clone().add(stopTime, 'minutes')
    })
  }

  return timetable
}

async function matchStopFromNSP(stops, stopTime, nspTrip) {
  const timeHHMM = dateUtils.toHHMM(stopTime)
  const matchingStop = nspTrip.stopTimings.find(stop => stop.departureTime.startsWith(timeHHMM))
  if (matchingStop) {
    return await stops.findDocument({
      'bays.stopGTFSID': matchingStop.stopGTFSID
    })
  }
}

async function updateExistingTrip(db, tripDB, existingTrip, vlineTrip) {
  const stops = db.getCollection('stops')
  const timetables = db.getCollection('timetables')

  const nspTrip = await timetables.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: utils.getDayOfWeek(utils.parseDate(existingTrip.operationDays)),
    runID: vlineTrip.tdn
  })

  const vehicle = existingTrip.vehicle
  if (!vehicle || vlineTrip.consist) {
    if (!vehicle || (vehicle.consist.length === 0 && (vehicle.type !== vlineTrip.consist.type) || (vehicle.size !== vlineTrip.consist.size))) {
      await VLineTripUpdater.updateTrip(db, tripDB, {
        operationDays: existingTrip.operationDays,
        runID: existingTrip.runID,
        forcedVehicle: vlineTrip.consist
      }, {
        dataSource: 'vline-op-tt'
      })
    }
  }

  const originStop = vlineTrip.origin
    ? await getStopFromVNetName(stops, vlineTrip.origin)
    : await matchStopFromNSP(stops, vlineTrip.departureTime, nspTrip)

  const destinationStop = vlineTrip.destination
    ? await getStopFromVNetName(stops, vlineTrip.destination)
    : await matchStopFromNSP(stops, vlineTrip.arrivalTime, nspTrip)

  if (!originStop || !destinationStop) return null

  const isWTL = stop => stop.stopName === 'Westall Railway Station'

  if (!vlineTrip.origin) {
    const platform = isWTL(originStop) ? '3?' : null

    await VLineTripUpdater.addStopToTrip(
      db, tripDB, existingTrip.operationDays, existingTrip.runID, {
      stopName: originStop.stopName, scheduledDepartureTime: new Date(vlineTrip.departureTime.toISO()), platform
    }, 'vline-op-tt')
  }

  if (!vlineTrip.destination) {
    const platform = isWTL(destinationStop) ? '3?' : null
    await VLineTripUpdater.addStopToTrip(
      db, tripDB, existingTrip.operationDays, existingTrip.runID, {
      stopName: destinationStop.stopName, scheduledDepartureTime: new Date(vlineTrip.arrivalTime.toISO()), platform
    }, 'vline-op-tt')
  }

  await VLineTripUpdater.updateTripOriginDestination(
    db, tripDB, existingTrip.operationDays, existingTrip.runID,
    originStop.stopName, destinationStop.stopName, 'vline-op-tt'
  )

  const originStopIDs = originStop.bays
    .filter(bay => [GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain].includes(bay.mode))
    .map(bay => bay.stopGTFSID)
  const destStopIDs = destinationStop.bays
    .filter(bay => [GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain].includes(bay.mode))
    .map(bay => bay.stopGTFSID)

  const tripOriginStop = existingTrip.stopTimings.find(stop => originStopIDs.includes(stop.stopGTFSID))
  const tripDestStop = existingTrip.stopTimings.find(stop => destStopIDs.includes(stop.stopGTFSID))

  if (tripOriginStop && tripDestStop) {
    const originOffset = vlineTrip.departureTime - new Date(tripOriginStop.scheduledDepartureTime)
    const destinationOffset = vlineTrip.arrivalTime - new Date(tripDestStop.scheduledDepartureTime)

    if (originOffset !== 0 && Math.abs(originOffset - destinationOffset) <= 5 * 60 * 1000) {
      await VLineTripUpdater.setTripTimeOffset(
        db, tripDB, existingTrip.operationDays, existingTrip.runID,
        originOffset, 'vline-op-tt'
      )
    }
  }
}

export default async function loadOperationalTT(db, tripDB, ptvAPI) {
  const liveTimetables = db.getCollection('live timetables')
  const heatTimetables = db.getCollection('heat timetables')
  const gtfsTimetables = db.getCollection('gtfs timetables')

  const outputTrips = []

  const departures = await ptvAPI.vline.getDepartures('', GetPlatformServicesAPI.BOTH, 1440)
  const arrivals = await ptvAPI.vline.getArrivals('', GetPlatformServicesAPI.BOTH, 1440)
  const newTrips = []

  const tripsNeedingFetch = []

  for (let vlineTrip of departures.concat(arrivals)) {
    // TODO: Cleanup with date library cleanup
    const operationDay = utils.parseTime(vlineTrip.departureTime.toUTC().toISO())
    if (operationDay.get('hours') < 3) operationDay.add(-1, 'day')
    operationDay.startOf('day')

    const opDayFormat = utils.getYYYYMMDD(operationDay)
    const dayOfWeek = utils.getDayOfWeek(operationDay) // Technically should use public holiday thing

    let existingTrip = await VLineTripUpdater.getTripByTDN(liveTimetables, vlineTrip.tdn, opDayFormat)
    if (existingTrip) {
      await updateExistingTrip(db, tripDB, existingTrip, vlineTrip)
      continue
    }

    let matchingTrip = await matchTrip(opDayFormat, operationDay, vlineTrip, db, gtfsTimetables, 2)
    let flags = null
    let allowNSP = true

    if (!matchingTrip && (matchingTrip = await matchTrip(dayOfWeek, operationDay, vlineTrip, db, heatTimetables, 2))) {
      flags = { heatTT: matchingTrip.type }
      allowNSP = false
      matchingTrip.vehicle = null
    } else if (!matchingTrip) {
      matchingTrip = await matchTrip(opDayFormat, operationDay, vlineTrip, db, gtfsTimetables, 20)
    }

    let nspTrip = allowNSP ? await VLineUtils.getNSPTrip(dayOfWeek, vlineTrip.tdn, db) : null
    if (matchingTrip) {
      let liveTrip = convertToLive(matchingTrip, operationDay)
      liveTrip.runID = vlineTrip.tdn
      liveTrip.direction = vlineTrip.direction
      if (flags) liveTrip.flags = flags
      if (nspTrip) {
        liveTrip.formedBy = nspTrip.formedBy
        liveTrip.forming = nspTrip.forming
      }

      liveTrip.vehicle = vlineTrip.consist
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
    tripsNeedingFetch.push({ operationDay, opDayFormat, vlineTrip, nspTrip })
  }

  let missingPatternTrips = tripsNeedingFetch.slice(15)
  for (let { operationDay, opDayFormat, vlineTrip, nspTrip } of tripsNeedingFetch.slice(0, 15)) {
    let pattern = await downloadTripPattern(opDayFormat, vlineTrip, nspTrip, db)
    if (!pattern) {
      missingPatternTrips.push({ operationDay, opDayFormat, vlineTrip })
      continue
    }

    pattern.forcedVehicle = vlineTrip.consist
    outputTrips.push({
      replaceOne: {
        filter: pattern.getDBKey(),
        replacement: pattern.toDatabase(),
        upsert: true
      }
    })
  }

  let missingTrips = []
  // Matching TDN found, but times incorrect: Find a trip with same time profile and shift times to match
  for (let { operationDay, opDayFormat, vlineTrip } of missingPatternTrips) {
    let scheduledTDN = await getScheduledTripByTDN(opDayFormat, vlineTrip, db)
    if (scheduledTDN) {
      let matchingTrip = await findMatchingTrip(operationDay, opDayFormat, scheduledTDN, vlineTrip, db)
      if (matchingTrip) {
        matchingTrip.forcedVehicle = vlineTrip.consist
        outputTrips.push({
          replaceOne: {
            filter: matchingTrip.getDBKey(),
            replacement: matchingTrip.toDatabase(),
            upsert: true
          }
        })
        continue
      }
    }

    missingTrips.push({ vlineTrip })
  }

  if (outputTrips.length) await liveTimetables.bulkWrite(outputTrips)
  await Promise.all(newTrips.map(({ liveTrip, vlineTrip }) => updateExistingTrip(db, tripDB, liveTrip, vlineTrip)))

  return missingTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  const stubDepartures = process.argv.includes('--stub-departures')

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  let vlineAPIInterface = stubDepartures ?
      await (new PartialStubVLineAPI(config.vlineCallerID, config.vlineSignature).init())
    : new VLineAPIInterface(config.vlineCallerID, config.vlineSignature)

  ptvAPI.addVLine(vlineAPIInterface)

  const missingTrips = await loadOperationalTT(database, tripDatabase, ptvAPI)
  if (missingTrips.length) {
    const tripData = `Missing V/Line trips (${missingTrips.length}):\n` + missingTrips.map(
      ({ vlineTrip }) => `TD${vlineTrip.tdn}: ${vlineTrip.departureTime.toFormat('HH:mm')} ${vlineTrip.origin} - ${vlineTrip.destination}`
    ).join('\n')
    console.log(tripData)

    await discordIntegration('vlineOpTT', tripData)
  }

  await database.close()
  await tripDatabase.close()
}
