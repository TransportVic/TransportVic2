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

  const destinationIndex = routeStops.length - 1
  const destination = routeStops[destinationIndex]
  const routeStopIndexes = routeStops.reduce((acc, stop, index) => {
    acc[stop] = index
    return acc
  }, {})

  let texts = []
  let lastStop = null

  expressSections.forEach((expressSection, i) => {
    const firstExpressStop = expressSection[0]
    const lastExpressStop = expressSection[expressSection.length - 1]

    const previousStopIndex = routeStopIndexes[firstExpressStop] - 1
    const nextStopIndex = routeStopIndexes[lastExpressStop] + 1

    const previousStop = routeStops[previousStopIndex]
    const nextStop = routeStops[nextStopIndex]

    // Not the first express section
    if (lastStop) {
      const lastStopIndex = routeStopIndexes[lastStop]

      if (i === expressSections.length - 1 && nextStopIndex === destinationIndex) {
        // Last express section and running express to the last stop
        texts.push(stoppingText.thenRunsExpressAtoB.format(previousStop, nextStop))
      } else if (lastStopIndex === previousStopIndex) {
        // Stopped at one stop from the previous express section, then ran express again
        texts.push(stoppingText.expressAtoB.format(previousStop, nextStop))
      } else if (lastStopIndex + 1 === previousStopIndex) {
        // Stopped at two stops in between express sections
        texts.push(stoppingText.runsExpressAtoB.format(previousStop, nextStop))
      } else {
        // 3 or more stations in betwee nexpress sections
        texts.push(stoppingText.sasAtoB.format(lastStop, previousStop))
        texts.push(stoppingText.runsExpressAtoB.format(previousStop, nextStop))
      }

      lastStop = nextStop
    } else { // This is the first express section
      lastStop = nextStop

      if (previousStopIndex === 0) {
        // If immediately running express from the first stop onwards
        texts.push(stoppingText.runsExpressTo.format(nextStop))
      } else {
        if (previousStopIndex === 1) {
          // Has one stop from the current before running express
          texts.push(stoppingText.stopsAt.format(previousStop))
        } else {
          // Has more than one stop from the current before running express
          texts.push(stoppingText.sasTo.format(previousStop))
        }

        if (nextStopIndex === destinationIndex) {
          // This express section runs straight to the destination
          texts.push(stoppingText.thenRunsExpressTo.format(nextStop))
        } else {
          // More stops after this express section
          texts.push(stoppingText.runsExpressAtoB.format(previousStop, nextStop))
        }
      }
    }
  })

  if (routeStopIndexes[lastStop] !== destinationIndex) {
    texts.push(stoppingText.thenSASTo.format(destination))
  }

  return texts.join(', ')
}