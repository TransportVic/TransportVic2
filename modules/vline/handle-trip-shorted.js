module.exports = async function (trip, departure, nspTrip, liveTimetables, date) {
  if (!trip) return
  if (trip.destination !== departure.destination || trip.origin !== departure.origin) {
    let hasSeenOrigin = false, hasSeenDestination = false

    let modifications = []
    if (trip.origin !== departure.origin) modifications.push({
      type: 'originate',
      changePoint: departure.origin.slice(0, -16)
    })

    if (trip.destination !== departure.destination) modifications.push({
      type: 'terminate',
      changePoint: departure.destination.slice(0, -16)
    })

    trip.type = 'change'
    trip.modifications = modifications
    trip.cancelled = false

    trip.stopTimings = trip.stopTimings.map(stop => {
      if (stop.stopName === departure.origin) {
        hasSeenOrigin = true
        stop.cancelled = false
        return stop
      } else if (stop.stopName === departure.destination) {
        hasSeenDestination = true
        stop.cancelled = false
        return stop
      }

      if (hasSeenDestination || !hasSeenOrigin) {
        stop.cancelled = true
      } else {
        stop.cancelled = false
      }

      return stop
    })

    trip.runID = departure.runID
    trip.operationDays = date

    if (nspTrip) {
      trip.vehicle = nspTrip.vehicle
    }

    delete trip._id
    await liveTimetables.replaceDocument({
      operationDays: date,
      runID: departure.runID,
      mode: 'regional train'
    }, trip, {
      upsert: true
    })
  } else if (!nspTrip) {
    trip.runID = departure.runID
    trip.operationDays = date

    delete trip._id
    await liveTimetables.replaceDocument({
      operationDays: date,
      runID: departure.runID,
      mode: 'regional train'
    }, trip, {
      upsert: true
    })
  }
}
