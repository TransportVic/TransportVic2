import turf from '@turf/turf'
import utils from '../../../utils.js'
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'

export async function updateTrips(getPositions = () => [], keepOperators = () => [], db) {
  const trips = await getRelevantTrips(getPositions, keepOperators)
  for (let tripPos of trips) {
    const tripData = await getTripData(tripPos, db)
    const { arrDelay } = getEstimatedArrivalTime(tripPos, tripData)
    const tripUpdate = {
      operationDays: tripData.trip.operationDays,
      runID: tripData.trip.runID,
      stops: tripData.trip.stopTimings.slice(tripData.nextStopIndex).map(stop => {
        return {
          stopName: stop.stopName,
          estimatedDepartureTime: utils.parseTime(stop.scheduledDepartureTime).add(arrDelay, 'seconds')
        }
      })
    }
    await MetroTripUpdater.updateTrip(db, tripUpdate, { skipStopCancellation: true, dataSource: 'gps-tracking' })
  }
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
  if (distanceToPath > 50) return null

  const nextStopIndex = tripData.stopTimings.findIndex(stop => parseFloat(stop.stopDistance) > pathDistance)
  const nextStop = tripData.stopTimings[nextStopIndex]
  const prevStop = tripData.stopTimings[nextStopIndex - 1]

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