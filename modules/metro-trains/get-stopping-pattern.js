export async function getTripUpdateData(runID, ptvAPI) {
  let trip = await ptvAPI.metro.getStoppingPatternFromTDN(runID, {
    includeForming: true
  })

  let tripData = {
    operationDays: trip.runData.operationDay,
    runID: trip.runData.tdn,
    routeGTFSID: trip.routeData.gtfsRouteID,
    stops: [],
    cancelled: trip.runData.cancelled
  }

  return tripData
}