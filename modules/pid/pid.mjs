import getLineStops from '../../additional-data/route-stops.js'
import getMetroDepartures from '../metro-trains/get-departures.js'

const stoppingText = {
  stopsAll: 'Stops All Stations',
  allExcept: 'All Except {0}',
  expressAtoB: '{0} to {1}',
  sasAtoB: 'Stops All Stations from {0} to {1}',
  runsExpressAtoB: 'Runs Express from {0} to {1}',
  runsExpressTo: 'Runs Express to {0}',
  thenRunsExpressTo: 'then Runs Express to {0}',
  thenRunsExpressAtoB: 'then Runs Express from {0} to {1}',
  sasTo: 'Stops All Stations to {0}',
  stopsAt: 'Stops At {0}',
  thenSASTo: 'then Stops All Stations to {0}'
}

export async function getPIDDepartures(stationName, db, { departureTime = new Date() } = {}) {
  const stops = await db.getCollection('stops')
  const stationData = await stops.findDocument({ stopName: `${stationName} Railway Station` })
  const metroDepartures = await getMetroDepartures(stationData, db, false, false, departureTime)

  return metroDepartures.map(departure => {
    const expressData = getScreenStopsAndExpress([
      stationName,
      ...departure.futureStops
    ], departure.trip)

    return {
      ...departure,
      stops: expressData.stops
    }
  })
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

  return { stops: outputStops, expressSections, routeStops: relevantRouteStops }
}

export function getStoppingText({ expressSections, routeStops }) {
  if (expressSections.length === 0) return stoppingText.stopsAll
  if (expressSections.length === 1 && expressSections[0].length === 1) return stoppingText.allExcept.format(expressSections[0][0])

  let currentStation = routeStops[0]
  let destination = routeStops[routeStops.length - 1]

  let texts = []
  let lastStop = null

  expressSections.forEach((expressSection, i) => {
    let firstExpressStop = expressSection[0]
    let lastExpressStop = expressSection.slice(-1)[0]

    let previousStopIndex = routeStops.indexOf(firstExpressStop) - 1
    let nextStopIndex = routeStops.indexOf(lastExpressStop) + 1

    let previousStop = routeStops[previousStopIndex]
    let nextStop = routeStops[nextStopIndex]

    if (lastStop) {
      let lastStopIndex = routeStops.indexOf(lastStop)

      if (i === expressSections.length - 1 && nextStop === destination) {
        texts.push(stoppingText.thenRunsExpressAtoB.format(previousStop, nextStop))
      } else if (lastStop === previousStop) {
        texts.push(stoppingText.expressAtoB.format(previousStop, nextStop))
      } else if (lastStopIndex + 1 === previousStopIndex) {
        texts.push(stoppingText.runsExpressAtoB.format(previousStop, nextStop))
      } else {
        texts.push(stoppingText.sasAtoB.format(lastStop, previousStop))
        texts.push(stoppingText.runsExpressAtoB.format(previousStop, nextStop))
      }
    } else {
      if (currentStation === previousStop) {
        texts.push(stoppingText.runsExpressTo.format(nextStop))
      } else {
        if (previousStopIndex - routeStops.indexOf(currentStation) === 1) {
          texts.push(stoppingText.stopsAt.format(previousStop))
        } else {
          texts.push(stoppingText.sasTo.format(previousStop))
        }
        if (nextStop === destination) {
          texts.push(stoppingText.thenRunsExpressTo.format(nextStop))
        } else {
          texts.push(stoppingText.runsExpressAtoB.format(previousStop, nextStop))
        }
      }
    }

    lastStop = nextStop
  })

  if (routeStops[routeStops.indexOf(lastStop)] !== destination) {
    texts.push(stoppingText.thenSASTo.format(destination))
  }

  return texts.join(', ')
}