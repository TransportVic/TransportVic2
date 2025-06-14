import { makePBRequest } from '../../gtfsr/gtfsr-api.js'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { MetroGTFSRTrip, UnscheduledMetroGTFSRTrip } from '../GTFSRTrip.mjs'
import { getStop, updateTrip } from '../../metro-trains/trip-updater.mjs'
import { parseConsist } from '../../metro-trains/fleet-parser.js'
import metroConsists from '../../../additional-data/metro-tracker/metro-consists.json' with { type: 'json' }

export async function getFleetData(db, gtfsrAPI) {
  let tripData = await gtfsrAPI('metrotrain-vehicleposition-updates')

  let trips = {}

  for (let trip of tripData.entity) {
    let gtfsrTripData = MetroGTFSRTrip.parse(trip.vehicle.trip)

    let tripData = {
      operationDays: gtfsrTripData.getOperationDay(),
      runID: gtfsrTripData.getTDN(),
      routeGTFSID: gtfsrTripData.getRouteID(),
      consist: parseConsist(trip.vehicle.vehicle.id, metroConsists)
    }

    trips[tripData.runID] = tripData
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