import getMetroDepartures from '../metro-trains/get-departures.js'
import { ALTONA_LOOP, CITY_LOOP, METRO_TUNNEL_GROUP, MTP_STOPS, MURL, NON_MTP_STOPS, NORTHERN_GROUP, NPT_LAV_MAINLINE } from '../metro-trains/line-groups.mjs'
import getLineStops from './route-stops.mjs'

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

const stoppingType = {
  noSuburban: 'No Suburban Passengers',
  notTakingPax: 'Not Taking Passengers',
  // vlinePostfix: ', Not Taking Suburban Passengers',
  stopsAll: 'Stops All',
  limitedExpress: 'Ltd Express',
  express: 'Express'
}

const extendedStoppingType = {
  notStoppingAt: 'Not Stopping At {0}',
  stopsAll: 'Stopping All Stations',
  limitedExpress: 'Ltd Express',
  express: 'Express',
  stopsAt: 'Stopping at {0}',
  expressTo: 'Express to {0}',
  expressAToB: 'Express {0} -- {1}'
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

    if (departure.formingTrip) {
      const formingExpressData = getScreenStopsAndExpress(
        departure.futureFormingStops.slice(departure.futureStops.length - 1),
        departure.formingTrip
      )

      expressData.stops.push(...formingExpressData.stops.slice(1))
      expressData.expressSections.push(...formingExpressData.expressSections)
      expressData.routeStops.push(...formingExpressData.routeStops.slice(1))
    }

    return {
      ...departure,
      stops: expressData.stops,
      stoppingPattern: getStoppingText(expressData),
      stoppingType: getStoppingType(expressData),
      extendedStoppingType: getExtendedStoppingType(expressData)
    }
  })
}

export function getScreenStopsAndExpress(screenStops, trip) {
  const rawRouteStops = getLineStops(trip.routeName)
  const routeStops = trip.direction === 'Down' ? rawRouteStops : rawRouteStops.toReversed()
  const startIndex = routeStops.indexOf(screenStops[0])
  const endIndex = routeStops.indexOf(screenStops[screenStops.length - 1])

  // Need to handle city loop
  const isCityTrip = screenStops[0] === 'Flinders Street' || screenStops[screenStops.length - 1] === 'Flinders Street'
  const relevantRawRouteStops = routeStops.slice(startIndex, endIndex + 1)
  let relevantRouteStops = relevantRawRouteStops

  const isNorthern = NORTHERN_GROUP.includes(trip.routeName)
  if (isCityTrip) {
    const hasMURLStop = screenStops.some(stop => MURL.includes(stop))
    const hasSSS = screenStops.includes('Southern Cross')

    if (isNorthern) {
      const viaSSS = hasSSS || !hasMURLStop

      relevantRouteStops = relevantRawRouteStops.filter(stop => {
        if (!CITY_LOOP.includes(stop)) return true
        if (viaSSS && MURL.includes(stop)) return false
        else if (!viaSSS && stop === 'Southern Cross') return false

        return true
      })
    } else if (!hasMURLStop && !hasSSS) {
      relevantRouteStops = relevantRawRouteStops.filter(stop => !CITY_LOOP.includes(stop))
    }
  }

  if (METRO_TUNNEL_GROUP.includes(trip.routeName)) {
    const hasMTPStop = screenStops.some(stop => MTP_STOPS.includes(stop))
    if (hasMTPStop) {
      relevantRouteStops = relevantRouteStops.filter(stop => !NON_MTP_STOPS.includes(stop))
    } else {
      relevantRouteStops = relevantRouteStops.filter(stop => !MTP_STOPS.includes(stop))
    }
  }

  if (trip.routeName === 'Werribee') {
    if (screenStops.includes('Altona')) {
      relevantRouteStops = relevantRouteStops.filter(stop => !NPT_LAV_MAINLINE.includes(stop))
    } else {
      relevantRouteStops = relevantRouteStops.filter(stop => !ALTONA_LOOP.includes(stop))
    }
  }

  let outputStops = []
  let expressSections = []
  let currentExpressSection = []

  let tripIndex = 0
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

  const texts = expressSections.flatMap((expressSection, i) => {
    const firstExpressStop = expressSection[0]
    const lastExpressStop = expressSection[expressSection.length - 1]

    const previousStopIndex = routeStopIndexes[firstExpressStop] - 1
    const nextStopIndex = routeStopIndexes[lastExpressStop] + 1

    const previousStop = routeStops[previousStopIndex]
    const nextStop = routeStops[nextStopIndex]

    if (i === 0) {
      // This is the first express section

      // If immediately running express from the first stop onwards
      if (previousStopIndex === 0) return [ stoppingText.runsExpressTo.format(nextStop) ]
      return [
        // Has one stop from the current before running express
        // Otherwise has more than one stop from the current before running express
        previousStopIndex === 1 ? stoppingText.stopsAt.format(previousStop) : stoppingText.sasTo.format(previousStop),

        // This express section runs straight to the destination
        // Otherwise more stops after this express section
        nextStopIndex === destinationIndex ? stoppingText.thenRunsExpressTo.format(nextStop) : stoppingText.runsExpressAtoB.format(previousStop, nextStop),
      ]
    }

    // Not the first express section
    const prevExpressSection = expressSections[i - 1]
    const prevExpressLastStop = prevExpressSection[prevExpressSection.length - 1]
    const lastStopIndex = routeStopIndexes[prevExpressLastStop] + 1
    const lastStop = routeStops[lastStopIndex]

    if (i === expressSections.length - 1 && nextStopIndex === destinationIndex) {
      // Last express section and running express to the last stop
      return [ stoppingText.thenRunsExpressAtoB.format(previousStop, nextStop) ]
    } else if (lastStopIndex === previousStopIndex) {
      // Stopped at one stop from the previous express section, then ran express again
      return [ stoppingText.expressAtoB.format(previousStop, nextStop) ]
    } else if (lastStopIndex + 1 === previousStopIndex) {
      // Stopped at two stops in between express sections
      return [ stoppingText.runsExpressAtoB.format(previousStop, nextStop) ]
    } else {
      // 3 or more stations in between express sections
      return [
        stoppingText.sasAtoB.format(lastStop, previousStop),
        stoppingText.runsExpressAtoB.format(previousStop, nextStop)
      ]
    }
  })

  const lastExpressSection = expressSections[expressSections.length - 1]
  const lastExpressStop = lastExpressSection[lastExpressSection.length - 1]

  if (routeStopIndexes[lastExpressStop] + 1 !== destinationIndex) texts.push(stoppingText.thenSASTo.format(destination))

  return texts.join(', ')
}

export function getStoppingType({ expressSections }) {
  if (expressSections.length === 0) return stoppingType.stopsAll
  if (expressSections.length === 1) {
    if (expressSections[0].length < 3) return stoppingType.limitedExpress
    return stoppingType.express
  }
  return stoppingType.limitedExpress
}

export function getExtendedStoppingType({ routeStops, expressSections }) {
  if (expressSections.length === 0) return extendedStoppingType.stopsAll
  if (expressSections.length === 1) {
    if (expressSections[0].length === 1) return extendedStoppingType.notStoppingAt.format(expressSections[0][0])
    if (routeStops[1] === expressSections[0][0]) return extendedStoppingType.expressTo.format(routeStops[expressSections[0].length + 1])
    const stopBeforeExpressIndex = routeStops.indexOf(expressSections[0][0])
    return extendedStoppingType.expressAToB.format(routeStops[stopBeforeExpressIndex - 1], routeStops[stopBeforeExpressIndex + expressSections[0].length])
  } else {
    if (routeStops[1] === expressSections[0][0]) return extendedStoppingType.stopsAt.format(routeStops[expressSections[0].length + 1])
  }
  return extendedStoppingType.limitedExpress
}