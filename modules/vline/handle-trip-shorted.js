module.exports = async function (trip, departure, nspTrip, liveTimetables, date) {
  if (trip && trip.destination !== departure.destination || trip.origin !== departure.origin) {
    let stoppingAt = trip.stopTimings.map(e => e.stopName)
    let destinationIndex = stoppingAt.indexOf(departure.destination)

    let skipping = []
    if (trip.destination !== departure.destination) {
      skipping = trip.stopTimings.slice(destinationIndex + 1).map(e => e.stopName)

      trip.stopTimings = trip.stopTimings.slice(0, destinationIndex + 1)
      let lastStop = trip.stopTimings[destinationIndex]

      trip.destination = lastStop.stopName
      trip.destinationArrivalTime = lastStop.arrivalTime
      lastStop.departureTime = null
      lastStop.departureTimeMinutes = null
    }

    let originIndex = stoppingAt.indexOf(departure.origin)
    if (trip.origin !== departure.origin) {
      skipping = skipping.concat(trip.stopTimings.slice(0, originIndex).map(e => e.stopName))

      trip.stopTimings = trip.stopTimings.slice(originIndex)
      let firstStop = trip.stopTimings[0]

      trip.origin = firstStop.stopName
      trip.departureTime = firstStop.departureTime
      firstStop.arrivalTime = null
      firstStop.arrivalTimeMinutes = null
    }

    trip.skipping = skipping
    trip.runID = departure.runID
    trip.originalServiceID = trip.originalServiceID || departure.originDepartureTime.format('HH:mm') + trip.destination
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
