const metroConsists = require('../../additional-data/metro-tracker/metro-consists.json')
const { parseConsistFromMotors } = require('./fleet-parser')

module.exports = async function getTripUpdateData(runID, ptvAPI, { date = new Date() } = {}) {
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

  return tripData
}