import { MongoDatabaseConnection } from '@transportme/database'
import { MetroSiteAPIInterface, PTVAPI } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'

import { getStop, getTrip, updateTrip } from '../../metro-trains/trip-updater.mjs'
import getTripID from './get-trip-id.mjs'
import utils from '../../../utils.js'

import config from '../../../config.json' with { type: 'json' }

export async function getRailBusUpdates(db, ptvAPI) {
  let tripUpdates = await ptvAPI.metroSite.getRailBusUpdates()

  let now = utils.now()
  let operationDay = utils.now().startOf('day')
  let hours = utils.now().get('hour')
  if (hours < 3) operationDay.add(-1, 'day')

  let nextDay = operationDay.clone().add(1, 'day')
  let previousDay = operationDay.clone().add(-1, 'day')

  let dayEnding = 2 <= hours && hours < 3
  let dayJustStarted = 3 <= hours && hours <= 4

  let output = []
  for (let trip of tripUpdates) {
    let runID = getTripID(trip.tripID)
    let tripOperationDay = utils.getYYYYMMDD(operationDay)
    let dbTrip = await getTrip(db, runID, tripOperationDay)

    if (!dbTrip) {
      if (dayJustStarted) {
        tripOperationDay = utils.getYYYYMMDD(previousDay)
        dbTrip = await getTrip(db, runID, tripOperationDay)
      } else if (dayEnding) {
        tripOperationDay = utils.getYYYYMMDD(nextDay)
        dbTrip = await getTrip(db, runID, tripOperationDay)
      }

      if (!dbTrip) continue // Still couldn't match, skip

      let tripStartTime = utils.parseTime(dbTrip.stopTimings[0].scheduledDepartureTime)
      if (Math.abs(tripStartTime.diff(now, 'hours')) > 3) continue // Seem to have matched a bad trip, skip it
    }

    let tripData = {
      operationDays: tripOperationDay,
      runID,
      routeGTFSID: '2-RRB',
      stops: []
    }

    for (let stop of trip.stopTimings) {
      let stopData = await getStop(db, stop.stopGTFSID)
      if (!stopData) {
        tripData = null
        break
      }
      tripData.stops.push({
        stopName: stopData.fullStopName,
        estimatedDepartureTime: new Date(stop.estimatedDepartureTime.toUTC().toISO()),
        estimatedArrivalTime: new Date(stop.estimatedDepartureTime.toUTC().toISO())
      })
    }

    if (tripData) output.push(tripData)
  }

  return output
}

export async function fetchTrips(db, ptvAPI) {
  let relevantTrips = await getRailBusUpdates(db, ptvAPI)
  console.log('MTM Rail Bus: Fetched', relevantTrips.length, 'trips')

  for (let tripData of relevantTrips) {
    await updateTrip(db, tripData, { skipStopCancellation: true, dataSource: 'mtm-website-rail' })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  await fetchTrips(mongoDB, ptvAPI)

  process.exit(0)
}