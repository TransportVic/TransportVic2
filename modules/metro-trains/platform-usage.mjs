import getMetroDepartures from './get-departures.js'

export async function getPlatformUsage(db, station, time) {
  let departures = await getMetroDepartures(station, db, null, null, time, { returnArrivals: true, timeframe: 30 })
}