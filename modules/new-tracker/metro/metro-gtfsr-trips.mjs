import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { RailGTFSRTrip, UnscheduledRailGTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import _ from '../../../init-loggers.mjs'

export async function getUpcomingTrips(db, gtfsrAPI, routeFilter = '') {
  let tripData = await gtfsrAPI('metro/trip-updates')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = RailGTFSRTrip.parse(trip.trip_update.trip)
    if (!gtfsrTripData.getRouteID().includes(routeFilter) && gtfsrTripData.getScheduleRelationship() !== RailGTFSRTrip.SR_CANCELLED) continue

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      stops: [],
      cancelled: gtfsrTripData.getScheduleRelationship() === RailGTFSRTrip.SR_CANCELLED,
      additional: gtfsrTripData.getScheduleRelationship() === RailGTFSRTrip.SR_ADDED,
      scheduledStartTime: gtfsrTripData.getStartTime()
    }

    for (let stop of trip.trip_update.stop_time_update) {
      let stopData = await MetroTripUpdater.getStop(db, stop.stop_id)
      let tripStop = {
        stopName: stopData.fullStopName,
        platform: stopData.platform || null,
        scheduledDepartureTime: null,
        // cancelled: stop.schedule_relationship === 1
      }

      if (stop.schedule_relationship === 1) tripStop.cancelled = true
      if (stop.arrival) tripStop.estimatedArrivalTime = new Date(stop.arrival.time * 1000)
      if (stop.departure) tripStop.estimatedDepartureTime = new Date(stop.departure.time * 1000)

      tripData.stops.push(tripStop)
    }

    if (!trips[tripData.runID]) trips[tripData.runID] = tripData
    if (trips[tripData.runID] && trips[tripData.runID] instanceof UnscheduledRailGTFSRTrip && trips[tripData.runID].cancelled && !tripData) {
      trips[tripData.runID] = tripData
    }
  }

  return Object.values(trips)
}

export async function fetchTrips(db, routeFilter = '') {
  let relevantTrips = await getUpcomingTrips(db, makePBRequest, routeFilter)
  global.loggers.trackers.metro.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    // TODO: Implement separate arrival/departure times
    let lastStop = tripData.stops[tripData.stops.length - 1]
    if (lastStop) lastStop.estimatedDepartureTime = lastStop.estimatedArrivalTime

    // GTFSR data currently does not support platform changes
    tripData.stops.forEach(stop => { delete stop.platform })

    await MetroTripUpdater.updateTrip(db, tripData, { skipStopCancellation: true, dataSource: 'gtfsr-trip-update' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchTrips(mongoDB, process.argv[2] || '')

  process.exit(0)
}