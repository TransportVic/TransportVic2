import getMetroDepartures from '../metro-trains/get-departures.js'

export async function getPIDDepartures(stationName, db, { departureTime = new Date() } = {}) {
  const stops = await db.getCollection('stops')
  const stationData = await stops.findDocument({ stopName: `${stationName} Railway Station` })
  const metroDepartures = await getMetroDepartures(stationData, db, false, false, departureTime)

  return metroDepartures
}

export function getScreenStops(screenStops, metroDeparture) {

}