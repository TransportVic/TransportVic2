const utils = require('../../../utils')
const findTrip = require('../../vline/find-trip')
const { getDayOfWeek } = require('../../../public-holidays')

module.exports = async function (db, departureTime, origin, destination) {
  let now = utils.now()
  let hoursNow = now.get('hours')
  let departureHour = parseInt(departureTime.slice(0, 2))
  if (hoursNow <= 2) {
    if ((hoursNow < 3 || hoursNow > 21) && departureHour === 12) {
      departureTime = `00:${departureTime.slice(3)}`
      departureHour = 0
    }

    if (departureHour <= 2) now.add(-1, 'day')
  }
  let today = utils.getYYYYMMDD(now)
  let operationDay = await getDayOfWeek(now)

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
  let timetables = db.getCollection('timetables')

  if (departureTime.split(':')[0].length == 1) {
    departureTime = `0${departureTime}`
  }

  let trip
  let nspTrip = await findTrip(timetables, operationDay, origin, destination, departureTime)

  if (nspTrip) {
    trip = await liveTimetables.findDocument({
      operationDays: today,
      runID: nspTrip.runID,
      mode: 'regional train'
    }) || await findTrip(gtfsTimetables, today, origin, destination, departureTime)

    if (trip) {
      trip.runID = nspTrip.runID
      trip.vehicle = nspTrip.vehicle
    }
  } else {
    trip = await findTrip(liveTimetables, today, origin, destination, departureTime)
  }

  if (trip) {
    delete trip._id
  }

  return { trip, nspTrip, today }
}
