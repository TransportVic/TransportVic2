const utils = require('../../utils')
const findTrip = require('./find-trip')

module.exports = async function(departure, trip, gtfsTimetables, departureDay) {
  let destinationArrivalTime
  if (trip) {
    let tripDestinationArrivalHHMM = trip.destinationArrivalTime
    let minutesPastMidnight = utils.getMinutesPastMidnightFromHHMM(tripDestinationArrivalHHMM)
    destinationArrivalTime = utils.getMomentFromMinutesPastMidnight(minutesPastMidnight, utils.now())
    // We can take the shortcut approach of MPM, now as these trips do not run at odd hours of the day
  }

  if (departure.origin === 'Maryborough Railway Station' && (departure.runID === '8118' || departure.runID === '8158')) { // Maryborough - Southern Cross, joins with the Ararat - Ballarat
    trip = trip || await findTrip(gtfsTimetables, departureDay, departure.origin, 'Ballarat Railway Station', utils.formatHHMM(departure.originDepartureTime))
    if (trip) {
      departure.destination = 'Ballarat Railway Station'
      departure.destinationArrivalTime = destinationArrivalTime
    }
  }

  if (departure.origin === 'Ararat Railway Station' && (departure.runID === '8116' || departure.runID === '8160')) { // Ararat - Ballarat, but PTV programs it as Ararat - Southern Cross so we extend the tracker data
    if (trip) {
      departure.destination = 'Southern Cross Railway Station'
      departure.destinationArrivalTime = destinationArrivalTime
    }
  }

  return trip
}
