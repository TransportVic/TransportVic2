import turf from '@turf/turf'
import utils from '../../../utils.js'

export async function updateTrips(getPositions = () => [], keepOperators = () => []) {
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

  const nextStop = tripData.stopTimings.find(stop => parseFloat(stop.stopDistance) > pathDistance)

  return {
    nextStop, distance: parseFloat(nextStop.stopDistance) - pathDistance
  }
}