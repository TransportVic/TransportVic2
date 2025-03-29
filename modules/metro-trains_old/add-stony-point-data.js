const { getDayOfWeek } = require('../../public-holidays')

let singleSTYTrains = ['8500', '8502', '8508', '8510', '8509', '8512', '8515', '8517']

module.exports = async function (trip, departureTime, db) {
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
    trip.vehicle = { size: 2, type: 'Sprinter', consist: [] }

    if (!['Sat', 'Sun'].includes(query.operationDays) && singleSTYTrains.includes(trip.runID)) {
      trip.vehicle.size = 1
    }
  }

  return trip
}

module.exports.singleSTYTrains = singleSTYTrains
