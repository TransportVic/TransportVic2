module.exports = async function (trip, departure, nspTrip, liveTimetables, date) {
  if (trip && trip.destination !== departure.destination || trip.origin !== departure.origin) {
    let hasSeenOrigin = false, hasSeenDestination = false

    trip.stopTimings = trip.stopTimings.map(stop => {
      if (stop.stopName.slice(0, -16) === departure.origin) {
        hasSeenOrigin = true
        stop.cancelled = false
        return stop
      } else if (stop.stopName.slice(0, -16) === departure.destination) {
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
  }
}
