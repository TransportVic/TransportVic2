import { makePBRequest } from '../../gtfsr/gtfsr-api.js'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { MetroGTFSRTrip, UnscheduledMetroGTFSRTrip } from '../GTFSRTrip.mjs'
import { getStop, updateTrip } from '../../metro-trains/trip-updater.mjs'

export async function getUpcomingTrips(db, gtfsrAPI, routeFilter = '') {
  let tripData = await gtfsrAPI('metrotrain-tripupdates')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = MetroGTFSRTrip.parse(trip.trip_update.trip)
    if (!gtfsrTripData.getRouteID().includes(routeFilter)) continue

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      stops: [],
      cancelled: gtfsrTripData.getScheduleRelationship() === MetroGTFSRTrip.SR_CANCELLED
    }

    for (let stop of trip.trip_update.stop_time_update) {
      let stopData = await getStop(db, stop.stop_id)
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
    if (trips[tripData.runID] && trips[tripData.runID] instanceof UnscheduledMetroGTFSRTrip && trips[tripData.runID].cancelled && !tripData) {
      trips[tripData.runID] = tripData
    }
  }

  return Object.values(trips)
}

export async function fetchTrips(db, routeFilter = '') {
  let relevantTrips = await getUpcomingTrips(db, makePBRequest, routeFilter)
  console.log('GTFSR Updater: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    // TODO: Implement separate arrival/departure times
    let lastStop = tripData.stops[tripData.stops.length - 1]
    if (lastStop) lastStop.estimatedDepartureTime = lastStop.estimatedArrivalTime

    // GTFSR data currently does not support platform changes
    tripData.stops.forEach(stop => { delete stop.platform })

    await updateTrip(db, tripData, { skipStopCancellation: true, dataSource: 'gtfsr-trip-update' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await fetchTrips(mongoDB, process.argv[2] || '')

  process.exit(0)
}