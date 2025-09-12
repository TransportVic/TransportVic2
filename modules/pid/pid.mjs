import getLineStops from '../../additional-data/route-stops.js'
import getMetroDepartures from '../metro-trains/get-departures.js'

export async function getPIDDepartures(stationName, db, { departureTime = new Date() } = {}) {
  const stops = await db.getCollection('stops')
  const stationData = await stops.findDocument({ stopName: `${stationName} Railway Station` })
  const metroDepartures = await getMetroDepartures(stationData, db, false, false, departureTime)

  return metroDepartures
}

export function getScreenStopsAndExpress(screenStops, trip) {
  const rawRouteStops = getLineStops(trip.routeName)
  const routeStops = trip.direction === 'Down' ? rawRouteStops : rawRouteStops.toReversed()
  const startIndex = routeStops.indexOf(screenStops[0])
  const endIndex = routeStops.indexOf(screenStops[screenStops.length - 1])

  const relevantRouteStops = routeStops.slice(startIndex, endIndex + 1)

  let outputStops = []
  let expressSections = []
  let currentExpressSection = []

  let tripIndex = 0;
  for (let routeIndex = 0; routeIndex < relevantRouteStops.length; routeIndex++) {
    const stopName = relevantRouteStops[routeIndex]
    if (stopName === screenStops[tripIndex]) {
      outputStops.push({ stopName, express: false })
      tripIndex++
      if (currentExpressSection.length) {
        expressSections.push(currentExpressSection)
        currentExpressSection = []
      }
    } else {
      outputStops.push({ stopName, express: true })
      currentExpressSection.push(stopName)
    }
  }

  if (currentExpressSection.length) expressSections.push(currentExpressSection)

  return { stops: outputStops, expressSections }
}