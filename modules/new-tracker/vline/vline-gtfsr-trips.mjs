import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { GTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import VLineTripUpdater from '../../vline/trip-updater.mjs'
import _ from '../../../init-loggers.mjs'
import { getPlatformUsage } from '../../metro-trains/platform-usage.mjs'
import utils from '../../../utils.mjs'
import fs from 'fs/promises'

let EPH = 'East Pakenham Railway Station'

export async function getUpcomingTrips(db, gtfsrAPI) {
  let EPHStop = await db.getCollection('stops').findDocument({ stopName: EPH })
  let tripData = await gtfsrAPI('vline/trip-updates')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = GTFSRTrip.parse(trip.trip_update.trip)

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      stops: [],
      cancelled: gtfsrTripData.getScheduleRelationship() === GTFSRTrip.SR_CANCELLED,
      additional: gtfsrTripData.getScheduleRelationship() === GTFSRTrip.SR_ADDED
    }

    let dbTrip = await VLineTripUpdater.getTrip(db, tripData.runID, tripData.operationDays)
    if (!(dbTrip && dbTrip.flags && dbTrip.flags.heatTT)) {
      tripData.scheduledStartTime = gtfsrTripData.getStartTime()
    }

    let previousStopData = null

    for (let stop of trip.trip_update.stop_time_update) {
      let stopData = await VLineTripUpdater.getStop(db, stop.stop_id)
      let tripStop = {
        stopName: stopData.fullStopName,
        platform: stopData.platform || null,
        scheduledDepartureTime: null,
        cancelled: stop.schedule_relationship === 1
      }
      if (tripStop.cancelled && previousStopData && previousStopData.stopName === tripStop.stopName) continue

      let departureTime = stop.departure || stop.arrival

      if (stop.arrival) tripStop.estimatedArrivalTime = new Date(stop.arrival.time * 1000)
      if (departureTime) {
        tripStop.estimatedDepartureTime = new Date(departureTime.time * 1000)
        if (typeof stop.delay !== 'undefined') {
          tripStop.scheduledDepartureTime = new Date(departureTime.time * 1000 - departureTime.delay * 1000)
        }
      }

      tripData.stops.push(tripStop)
      previousStopData = tripStop
    }

    let firstStop = tripData.stops[0]
    let lastStop = tripData.stops[tripData.stops.length - 1]

    let firstStopEPH = firstStop && firstStop.stopName === EPH
    let lastStopEPH = lastStop && lastStop.stopName === EPH

    if (firstStopEPH && firstStop.cancelled) {
      firstStop.cancelled = false
      tripData.scheduledStartTime = null
    } else if (lastStopEPH && lastStop.cancelled) lastStop.cancelled = false

    let ephStop = (firstStopEPH && !firstStop.platform) ? firstStop : ((lastStopEPH && !lastStop.platform) ? lastStop : null)
    

    if (ephStop && dbTrip) {
      let tripEPH = firstStopEPH ? dbTrip.stopTimings[0] : dbTrip.stopTimings[dbTrip.stopTimings.length - 1]
      let ephSchTime = utils.parseTime(tripEPH.scheduledDepartureTime)
      let ephSchLower = ephSchTime.clone().add(-5, 'minutes')
      let ephSchUpper = ephSchTime.clone().add(5, 'minutes')

      let platformUsage = await getPlatformUsage(db, EPHStop, ephSchTime)

      let platformsUsed = Object.keys(platformUsage.filter(dwell => ephSchLower < dwell.end || ephSchUpper > dwell.start || (dwell.start <= ephSchTime && ephSchTime <= dwell.end)).reduce((acc, dwell) => {
        acc[dwell.platform] = 1
        return acc
      }, {}))

      if (platformsUsed.length === 1) ephStop.platform = platformsUsed[0].platform === '1' ? '2' : '1'
    }

    if (tripData.cancelled || (tripData.stops[0] && tripData.stops[0].cancelled)) tripData.scheduledStartTime = null // Remove start time check since first stop wouldn't match
    if (!trips[tripData.runID]) trips[tripData.runID] = tripData
  }

  return Object.values(trips)
}

export async function fetchGTFSRTrips(db, tripDB, gtfsrAPI, existingTrips) {
  let relevantTrips = await getUpcomingTrips(db, gtfsrAPI)

  for (let tripData of relevantTrips) {
    try {
      await VLineTripUpdater.updateTrip(db, tripDB, tripData, {
        skipStopCancellation: true,
        dataSource: 'gtfsr-trip-update',
        skipWrite: true,
        existingTrips,
        propagateDelay: true,
        fullTrip: true
      })
    } catch (e) {
      global.loggers.trackers.vline.err('Failed to update TDN', tripData.runID)
      global.loggers.trackers.vline.err(e)
    }
  }

  return relevantTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  global.loggers.trackers.vline.log('V/Line GTFSR Updater: Loading trips')
  let relevantTrips = await fetchGTFSRTrips(database, tripDatabase, makePBRequest)
  global.loggers.trackers.vline.log('V/Line GTFSR Updater: Updated TDNs:', relevantTrips.map(trip => trip.runID).join(', '))

  process.exit(0)
}