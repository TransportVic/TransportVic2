import turf from '@turf/turf'
import utils from '../../../utils.mjs'
import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { getGPSPositions } from './get-positions.mjs'
import VLineTripUpdater from '../../vline/trip-updater.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

export async function updateTrips(getPositions = () => [], keepOperators = () => [], db, tripDB) {
  const trips = await getRelevantTrips(getPositions, keepOperators)
  const skippedTrips = []
  const updatedTrips = []

  for (let tripPos of trips.filter(trip => trip.runID.length === 4)) {
    const tripData = await getTripData(tripPos, db)
    if (!tripData) {
      skippedTrips.push(tripPos)
      continue
    }

    const { arrDelay } = getEstimatedArrivalTime(tripPos, tripData)
    const tripUpdate = {
      operationDays: tripData.trip.operationDays,
      runID: tripData.trip.runID,
      stops: tripData.trip.stopTimings.slice(tripData.nextStopIndex).map(stop => {
        return {
          stopName: stop.stopName,
          estimatedDepartureTime: utils.parseTime(stop.scheduledDepartureTime).add(arrDelay, 'seconds')
        }
      }),
      forcedVehicle: {
        consist: [ tripPos.vehicle ]
      }
    }

    updatedTrips.push(await VLineTripUpdater.updateTrip(db, tripDB, tripUpdate, { skipStopCancellation: true, dataSource: 'gps-tracking' }))
  }

  return { skippedTrips, updatedTrips }
}

export async function getRelevantTrips(getPositions = () => [], keepOperators = () => []) {
  const positions = await getPositions()
  const operators = keepOperators()
  return positions.filter(pos => operators.includes(pos.operator))
}

export async function getTripData(position, db) {
  const timetables = db.getCollection('live timetables')
  const routes = db.getCollection('routes')
  const tripData = await timetables.findDocument({
    operationDays: utils.getYYYYMMDD(position.updateTime.clone().startOf('day')),
    runID: position.runID
  })
  if (!tripData) return null

  const routeData = await routes.findDocument({ routeGTFSID: tripData.routeGTFSID })
  const shape = routeData.routePath.find(path => path.fullGTFSIDs.includes(tripData.shapeID))

  const nearestPointOnPath = turf.nearestPointOnLine(shape.path, position.location, { units: 'metres' })
  const { dist: distanceToPath, location: pathDistance } = nearestPointOnPath.properties
  if (distanceToPath > 100) return null
  const nextStopIndex = tripData.stopTimings.findIndex(stop => parseFloat(stop.stopDistance) > pathDistance)
  const nextStop = tripData.stopTimings[nextStopIndex]
  const prevStop = tripData.stopTimings[nextStopIndex - 1]

  if (!nextStop) return

  return {
    nextStop, nextStopIndex, prevStop, distance: parseFloat(nextStop.stopDistance) - pathDistance, trip: tripData
  }
}

export function getEstimatedArrivalTime(position, { nextStop, prevStop, distance }) {
  const travelTime = nextStop.arrivalTimeMinutes - prevStop.departureTimeMinutes
  const distanceTravelled = parseFloat(nextStop.stopDistance) - parseFloat(prevStop.stopDistance)
  const minutesPerMetre = travelTime / distanceTravelled

  const remainingTravelTime = distance * minutesPerMetre
  const estimatedArrivalTime = position.updateTime.clone().add(remainingTravelTime, 'minutes')
  const arrDelay = estimatedArrivalTime.diff(utils.parseTime(nextStop.scheduledDepartureTime), 'seconds')

  return {
    estimatedArrivalTime, arrDelay
  }
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  const tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await database.connect()

  const { skippedTrips, updatedTrips } = await updateTrips(getGPSPositions, () => config.keepOperators, database, tripDatabase)
  
  global.loggers.trackers.vline.log('> GPS Updater: Updated positions for', updatedTrips.map(trip => trip.runID))
  global.loggers.trackers.vline.log('> GPS Updater: Could not update positions for', skippedTrips.map(trip => trip.runID))

  process.exit(0)
}