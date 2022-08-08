const utils = require('../../utils')

module.exports = trip => {
  let stops = trip.stopTimings.map(s => s.stopName)

  let origin, destination, departureTime, destinationArrivalTime

  if (trip.direction === 'Up') {
    let fssIndex = stops.lastIndexOf('Flinders Street Railway Station')
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
  } else { // Down
    let fssIndex = stops.indexOf('Flinders Street Railway Station')
    if (fssIndex !== -1) {
      origin = 'Flinders Street Railway Station'
      originDepartureTime = trip.stopTimings[fssIndex].departureTime
    } else {
      if (stops.includes('Parliament Railway Station')) { // No FSS but we have PAR
        let rmdIndex = stops.indexOf('Richmond Railway Station')
        let jliIndex = stops.indexOf('Jolimont Railway Station')
        let sssIndex = stops.indexOf('Southern Cross Railway Station')

        let chosenIndex = [rmdIndex, jliIndex, sssIndex].find(index => index !== -1)
        if (chosenIndex) {
          origin = trip.stopTimings[chosenIndex].stopName
          originDepartureTime = trip.stopTimings[chosenIndex].departureTime
        }
      }

      if (!origin) {
        origin = trip.origin
        originDepartureTime = trip.departureTime
      }
    }

    trip.trueOrigin = origin
    trip.trueDepartureTime = originDepartureTime
    trip.trueDestination = trip.destination
    trip.trueDestinationArrivalTime = trip.destinationArrivalTime
  }

  return trip
}

module.exports.getTripTrueOriginDestination = trip => {
  let originStop = trip.stopTimings.find(stop => stop.stopName === (trip.trueOrigin || trip.origin))
  let destinationStop = trip.stopTimings.find(stop => stop.stopName === (trip.trueDestination || trip.destination))

  if (!trip.cancelled && (originStop.cancelled || destinationStop.cancelled)) {
    if (originStop.cancelled) {
      originStop = trip.stopTimings.slice(trip.stopTimings.indexOf(originStop)).find(stop => !stop.cancelled)
    } else if (destinationStop.cancelled) {
      let relevantStops = trip.stopTimings.slice(0, trip.stopTimings.indexOf(destinationStop) + 1)
      let lastStopIndex = utils.findLastIndex(relevantStops, stop => !stop.cancelled)
      destinationStop = relevantStops[lastStopIndex]
    }
  }

  return { originStop, destinationStop }
}
