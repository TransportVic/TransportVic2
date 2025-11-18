import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const isStationLevel = alert => alert.type === 'works' || alert.type === 'suspended'
const isIndividual = alert => alert.type === 'service'
const isSuspended = alert => alert.type === 'suspended'

export async function getStationAlerts(station, db) {
  const metroBays = station.bays.filter(bay => bay.mode === TRANSIT_MODES.metroTrain)
  const allScreenServices = metroBays.flatMap(bay => bay.screenServices).map(service => service.routeGTFSID)
  const uniqueRouteGTFSIDs = Array.from(new Set(allScreenServices))
  const routeNames = await db.getCollection('routes').distinct('routeName', {
    mode: TRANSIT_MODES.metroTrain,
    routeGTFSID: { $in: uniqueRouteGTFSIDs }
  })

  const activeAlerts = await db.getCollection('metro notify').findDocuments({
    routeName: { $in: routeNames },
    active: true
  }).toArray()

  const stationLevel = activeAlerts.filter(isStationLevel)
  const individual = activeAlerts.filter(isIndividual)
  const suspended = Array.from(new Set(activeAlerts.filter(isSuspended).flatMap(alert => alert.routeName)))

  return {
    general: stationLevel,
    individual,
    suspended
  }
}