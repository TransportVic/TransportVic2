const { getDayOfWeek } = require('../../public-holidays')
const stonyPointFormations = require('./stony-point-formations')

module.exports = async function (db, trip, departureTime) {
  let query = {
    mode: 'metro train',
    operationDays: await getDayOfWeek(departureTime),
    origin: trip.origin,
    destination: trip.destination,
    departureTime: trip.departureTime
  }

  let staticTrip = await db.getCollection('timetables').findDocument(query)
  if (staticTrip) {
    trip.stopTimings = trip.stopTimings.map(stop => {
      if (stop.stopName === 'Frankston Railway Station')
        stop.platform = '3'
      else
        stop.platform = '1'
      return stop
    })
    trip.runID = staticTrip.runID
    if (!['Sat', 'Sun'].includes(query.operationDays)) {
      if (stonyPointFormations.weekday[trip.runID]) {
        trip.vehicle = stonyPointFormations.weekday[trip.runID]
      }
    }

    trip.vehicle = trip.vehicle || '2 Car Sprinter'
  }

  return trip
}
