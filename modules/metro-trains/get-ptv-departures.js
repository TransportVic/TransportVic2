const getStoppingPatternData = require('./get-stopping-pattern.js')

module.exports = async function getTripUpdateData(db, stop, ptvAPI) {
  let liveTimetables = await db.getCollection('live timetables')
  let metroBay = stop.bays.find(bay => bay.mode === 'metro train' && bay.platform)

  let departures = await ptvAPI.metro.getDepartures(metroBay.stopGTFSID, {
    gtfs: true,
    maxResults: 5
  })

  if (!departures) return null

  let tripUpdates = {}

  let trains = departures.filter(dep => !dep.runData.isRailBus)
  let updatedTrips = trains.filter(dep => dep.runData.updated)
  let regularTrips = trains.filter(dep => !dep.runData.updated)

  for (let departure of updatedTrips) tripUpdates[departure.runData.tdn] = await getStoppingPatternData(departure.runData.tdn, ptvAPI)
  for (let departure of regularTrips) {
    let timetable = await liveTimetables.findDocument({
      mode: 'metro train',
      runID: departure.runData.tdn,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: metroBay.parentStopGTFSID,
          scheduledDepartureTime: departure.scheduledDeparture.toUTC().toISO()
        }
      }
    })

    if (timetable) {
      let tripData = {
        operationDays: timetable.operationDays,
        runID: departure.runData.tdn,
        routeGTFSID: timetable.routeGTFSID,
        stops: [{
          stopName: stop.stopName,
          platform: departure.platform,
          cancelled: false
        }],
        cancelled: departure.runData.cancelled
      }

      if (departure.estimatedDeparture) tripData.stops[0].estimatedDepartureTime = new Date(departure.estimatedDeparture.toUTC().toISO())
      if (departure.runData.formedBy) tripData.formedBy = departure.runData.formedBy.tdn
      if (departure.runData.forming) tripData.forming = departure.runData.forming.tdn
      tripUpdates[departure.runData.tdn] = tripData
    } else {
      tripUpdates[departure.runData.tdn] = await getStoppingPatternData(departure.runData.tdn, ptvAPI)
    }
  }

  return Object.values(tripUpdates)
}