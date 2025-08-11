import utils from '../../utils.js'
import getMetroDepartures from './get-departures.js'

export async function getPlatformUsage(db, station, time) {
  let startTime = utils.parseTime(time).add(-30, 'minutes')
  let trips = await getMetroDepartures(station, db, null, null, startTime, { returnArrivals: true, timeframe: 60 })
  let allTrips = trips.reduce((acc, e) => {
    acc[e.runID] = e
    return acc
  }, {})

  let arrivals = trips.filter(trip => trip.isArrival)
  let arrivalPlatformUsage = arrivals.map(trip => ({
    runID: trip.runID,
    start: trip.scheduledDepartureTime,
    end: trip.formingTrip && allTrips[trip.formingRunID] ? allTrips[trip.formingRunID].scheduledDepartureTime : trip.scheduledDepartureTime.clone().add(2, 'minutes')
  }))

  return arrivalPlatformUsage
}