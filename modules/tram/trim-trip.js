module.exports = async function(db, destination, coreRoute, trip, operationDay) {
  let cutoffStop

  if (coreRoute === '96' && destination == 'Clarendon St Junction') {
    cutoffStop = 'Port Junction/79 Whiteman Street'
  }

  if (cutoffStop && trip.destination !== cutoffStop) {
    let hasSeen = false

    trip.stopTimings = trip.stopTimings.filter(stop => {
      if (hasSeen) return false
      if (stop.stopName === cutoffStop) {
        return hasSeen = true
      }
      return true
    })

    trip.destination = cutoffStop
    trip.destinationArrivalTime = trip.stopTimings.slice(-1)[0].arrivalTime
    delete trip._id

    let key = {
      mode: 'tram',
      operationDays: operationDay,
      origin: trip.origin,
      departureTime: trip.departureTime,
      destination: cutoffStop,
      destinationArrivalTime: trip.destinationArrivalTime
    }

    await db.getCollection('live timetables').replaceDocument(key, trip, {
      upsert: true
    })
  }

  return trip
}
