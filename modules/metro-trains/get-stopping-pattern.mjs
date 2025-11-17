import metroConsists from '../../additional-data/metro-tracker/metro-consists.json' with { type: 'json' }
import { parseConsistFromMotors } from './fleet-parser.mjs'

export default async function getTripUpdateData(runID, ptvAPI, { date = new Date() } = {}) {
  let trip = await ptvAPI.metro.getStoppingPatternFromTDN(runID, {
    includeForming: true,
    date,
    expand: ['VehicleDescriptor', 'VehiclePosition']
  })

  if (!trip) return null

  let tripData = {
    operationDays: trip.runData.operationDay,
    runID: trip.runData.tdn,
    routeGTFSID: trip.routeData.gtfsRouteID,
    stops: trip.stops.map(stop => {
      let stopData = {
        stopName: stop.stationName + ' Railway Station',
        platform: stop.platform,
        cancelled: false
      }

      stopData.scheduledDepartureTime = new Date(stop.scheduledDeparture.toUTC().toISO())
      if (stop.estimatedDeparture) stopData.estimatedDepartureTime = new Date(stop.estimatedDeparture.toUTC().toISO())

      return stopData
    }),
    cancelled: trip.runData.cancelled
  }

  if (trip.runData.additional) tripData.additional = trip.runData.additional
  if (trip.runData.formedBy) tripData.formedBy = trip.runData.formedBy.tdn
  if (trip.runData.forming) tripData.forming = trip.runData.forming.tdn
  if (trip.runData.vehicle) {
    tripData.consist = parseConsistFromMotors(trip.runData.vehicle.motorCars, metroConsists)
  }

  let lastStop = tripData.stops[tripData.stops.length - 1]
  let secondLastStop = tripData.stops[tripData.stops.length - 2]
  if (lastStop.stopName === 'Flinders Street Railway Station' && trip.formingStops.length) {
    lastStop.estimatedDepartureTime = null

    if (secondLastStop && secondLastStop.stopName === 'Parliament Railway Station') { // 3 min PAR-FSS
      lastStop.scheduledDepartureTime = new Date(+secondLastStop.scheduledDepartureTime + 1000 * 60 * 3)
    } else if (secondLastStop && secondLastStop.stopName === 'Richmond Railway Station') { // 5 min RMD-FSS
      lastStop.scheduledDepartureTime = new Date(+secondLastStop.scheduledDepartureTime + 1000 * 60 * 5)
    } else if (secondLastStop && secondLastStop.stopName === 'Southern Cross Railway Station') { // 3 min SSS-FSS
      lastStop.scheduledDepartureTime = new Date(+secondLastStop.scheduledDepartureTime + 1000 * 60 * 3)
    } else if (secondLastStop && secondLastStop.stopName === 'Jolimont Railway Station') { // 3 min SSS-FSS
      lastStop.scheduledDepartureTime = new Date(+secondLastStop.scheduledDepartureTime + 1000 * 60 * 3)
    }
  }

  return tripData
}