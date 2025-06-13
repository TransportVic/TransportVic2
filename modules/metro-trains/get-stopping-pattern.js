module.exports = async function getTripUpdateData(runID, ptvAPI, { date = new Date() } = {}) {
  let trip = await ptvAPI.metro.getStoppingPatternFromTDN(runID, {
    includeForming: true,
    date
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
      // if (!(stop.stationName === 'Flinders Street' && trip.runData.direction.railDirection === 'Up')) {
        stopData.scheduledDepartureTime = new Date(stop.scheduledDeparture.toUTC().toISO())
        if (stop.estimatedDeparture) stopData.estimatedDepartureTime = new Date(stop.estimatedDeparture.toUTC().toISO())
      // }

      return stopData
    }),
    cancelled: trip.runData.cancelled
  }

  if (trip.runData.additional) tripData.additional = trip.runData.additional
  if (trip.runData.formedBy) tripData.formedBy = trip.runData.formedBy.tdn
  if (trip.runData.forming) tripData.forming = trip.runData.forming.tdn

  return tripData
}