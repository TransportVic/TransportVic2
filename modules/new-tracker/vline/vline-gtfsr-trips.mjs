import { makePBRequest } from '../../gtfsr/gtfsr-api.mjs'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { RailGTFSRTrip } from '../gtfsr/GTFSRTrip.mjs'
import VLineTripUpdater from '../../vline/trip-updater.mjs'

export async function getUpcomingTrips(db, gtfsrAPI) {
  let tripData = await gtfsrAPI('vline/trip-updates')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = RailGTFSRTrip.parse(trip.trip_update.trip)

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN() || trip.trip_update.vehicle.id,
      routeGTFSID: gtfsrTripData.getRouteID(),
      stops: [],
      cancelled: gtfsrTripData.getScheduleRelationship() === RailGTFSRTrip.SR_CANCELLED,
      additional: gtfsrTripData.getScheduleRelationship() === RailGTFSRTrip.SR_ADDED,
      scheduledStartTime: gtfsrTripData.getStartTime()
    }

    for (let stop of trip.trip_update.stop_time_update) {
      let stopData = await VLineTripUpdater.getStop(db, stop.stop_id)
      let tripStop = {
        stopName: stopData.fullStopName,
        platform: stopData.platform || null,
        scheduledDepartureTime: null,
        cancelled: stop.schedule_relationship === 1
      }

      if (stop.arrival) tripStop.estimatedArrivalTime = new Date(stop.arrival.time * 1000)
      if (stop.departure) {
        tripStop.estimatedDepartureTime = new Date(stop.departure.time * 1000)
        if (typeof stop.delay !== 'undefined') {
          tripStop.scheduledDepartureTime = new Date(stop.departure.time * 1000 - stop.departure.delay * 1000)
        }
      }

      tripData.stops.push(tripStop)
    }

    if (!trips[tripData.runID]) trips[tripData.runID] = tripData
  }

  return Object.values(trips)
}

export async function fetchTrips(db) {
  let relevantTrips = await getUpcomingTrips(db, makePBRequest)
  console.log('V/Line GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    await VLineTripUpdater.updateTrip(db, tripData, { skipStopCancellation: true, dataSource: 'gtfsr-trip-update' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchTrips(mongoDB)

  process.exit(0)
}