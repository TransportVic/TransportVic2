module.exports = trip => {
  let stops = trip.stopTimings.map(s => s.stopName)

  let origin, destination, departureTime, destinationArrivalTime

  if (trip.direction === 'Up') {
    let fssIndex = stops.indexOf('Flinders Street Railway Station')
    if (fssIndex !== -1) {
      destination = 'Flinders Street Railway Station'
      destinationArrivalTime = trip.stopTimings[fssIndex].arrivalTime
    } else {
      destination = trip.destination
      destinationArrivalTime = trip.destinationArrivalTime
    }

    trip.trueOrigin = trip.origin
    trip.trueDepartureTime = trip.departureTime
    trip.trueDestination = destination
    trip.trueDestinationArrivalTime = destinationArrivalTime
  } else {
    let fssIndex = stops.indexOf('Flinders Street Railway Station')
    if (fssIndex !== -1) {
      origin = 'Flinders Street Railway Station'
      originDepartureTime = trip.stopTimings[fssIndex].departureTime
    } else {
      origin = trip.origin
      originDepartureTime = trip.departureTime
    }

    trip.trueOrigin = origin
    trip.trueDepartureTime = originDepartureTime
    trip.trueDestination = trip.destination
    trip.trueDestinationArrivalTime = trip.destinationArrivalTime
  }

  return trip
}
