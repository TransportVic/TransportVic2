import { MongoDatabaseConnection } from '@transportme/database'
import { MetroSiteAPIInterface, PTVAPI } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'

import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import getTripID from './get-trip-id.mjs'
import utils from '../../../utils.mjs'

import config from '../../../config.json' with { type: 'json' }
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'
import discordIntegration from '../../discord-integration.mjs'
import { hostname } from 'os'
import { MTMRailStop } from '../../../load-gtfs/metro-rail-bus/loaders/MTMRailStopLoader.mjs'

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
    let dbTrip = await MetroTripUpdater.getTrip(db, runID, tripOperationDay)

    if (!dbTrip) {
      if (dayJustStarted) {
        tripOperationDay = utils.getYYYYMMDD(previousDay)
        dbTrip = await MetroTripUpdater.getTrip(db, runID, tripOperationDay)
      } else if (dayEnding) {
        tripOperationDay = utils.getYYYYMMDD(nextDay)
        dbTrip = await MetroTripUpdater.getTrip(db, runID, tripOperationDay)
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
      let stopData = await MetroTripUpdater.getStop(db, MTMRailStop.transformStopID(dbTrip.flags.operator, stop.stopGTFSID))
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

export async function fetchTrips(db, tripDB, ptvAPI) {
  let relevantTrips = await getRailBusUpdates(db, ptvAPI)

  let updatedTrips = []
  for (let tripData of relevantTrips) {
    updatedTrips.push(await MetroTripUpdater.updateTrip(db, tripDB, tripData, { skipStopCancellation: true, dataSource: 'mtm-website-rail', updateTime: new Date() }))
  }

  return updatedTrips
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `Metro RRB Trip Updater: ${hostname()} loading`)

  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  let updatedTrips = await fetchTrips(database, tripDatabase, ptvAPI)
  global.loggers.trackers.metroRRB.log('MTM Rail Bus: Fetched', updatedTrips.length, 'trips')

  await discordIntegration('taskLogging', `Metro RRB Trip Updater: ${hostname()} completed loading`)

  process.exit(0)
}