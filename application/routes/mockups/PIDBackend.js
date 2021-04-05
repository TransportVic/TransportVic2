const getRouteStops = require('../../../additional-data/route-stops')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
const destinationOverrides = require('../../../additional-data/coach-stops')
const utils = require('../../../utils')
const async = require('async')
const { getDayOfWeek } = require('../../../public-holidays')

let undergroundLoopStations = ['Parliament', 'Flagstaff', 'Melbourne Central']
let cityLoopStations = ['Southern Cross', ...undergroundLoopStations]
let cityStations = [...cityLoopStations, 'Flinders Street']

let northernGroup = ['Craigieburn', 'Sunbury', 'Upfield', 'Showgrounds/Flemington', 'Werribee', 'Williamstown']

let defaultStoppingText = {
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

let defaultStoppingType = {
  vlineService: {
    stoppingType: 'No Suburban Passengers'
  },
  sas: 'Stops All',
  limExp: 'Limited Express',
  exp: 'Express'
}

async function getAllDeparturesFromStation(station, db) {
  let departures = await utils.getData('pid-combined-departures', station.stopName, async () => {
    let vlineDepartures = []
    let metroDepartures = []
    let stationName = station.stopName.slice(0, -16)

    await Promise.all([
      new Promise(async resolve => {
        try {
          let vlinePlatform = station.bays.find(bay => bay.mode === 'regional train')
          if (vlinePlatform) {
            let rawVlineDepartures = await getVLineDepartures(station, db)
            vlineDepartures = rawVlineDepartures.map(departure => {
              let routeName = departure.shortRouteName

              if (routeName === 'Bendigo' && departure.allStops.includes('Eaglehawk')) routeName = 'Swan Hill'

              return {
                routeName,
                destination: departure.destination,
                scheduledDepartureTime: departure.scheduledDepartureTime,
                estimatedDepartureTime: departure.estimatedDepartureTime,
                actualDepartureTime: departure.actualDepartureTime,
                futureStops: [stationName, ...departure.futureStops],
                allStops: departure.allStops,
                direction: departure.trip.direction,
                isRailReplacementBus: departure.isRailReplacementBus,
                platform: departure.platform ? departure.platform.replace(/[?A-Z]/g, '') : '',
                type: 'vline'
              }
            })
          }
        } finally {
          resolve()
        }
      }),
      new Promise(async resolve => {
        try {
          let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
          if (metroPlatform) {
            let rawMetroDepartures = await getMetroDepartures(station, db)
            metroDepartures = rawMetroDepartures.map(departure => {
              let destination = departure.destination
              if (departure.routeName === 'City Circle') {
                if (stationName === 'Flinders Street') destination = 'City Loop'
                else destination = 'Flinders Street'
              }

              return {
                routeName: departure.routeName,
                destination,
                scheduledDepartureTime: departure.scheduledDepartureTime,
                estimatedDepartureTime: departure.estimatedDepartureTime,
                actualDepartureTime: departure.actualDepartureTime,
                futureStops: [stationName, ...departure.futureStops],
                allStops: departure.allStops,
                direction: departure.trip.direction,
                isRailReplacementBus: departure.isRailReplacementBus,
                platform: departure.platform ? departure.platform.replace(/[?A-Z]/g, '') : '',
                type: 'metro'
              }
            })
          }
        } finally {
          resolve()
        }
      })
    ])

    return [...metroDepartures, ...vlineDepartures].filter(departure => {
      return !departure.cancelled
    }).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  }, 1000 * 30)

  let now = utils.now()
  return departures.filter(departure => {
    let timeDifference = departure.actualDepartureTime.diff(now, 'seconds')
    return -30 <= timeDifference && timeDifference <= 120 * 60
  })
}

function getRouteStopsForDeparture(departure) {
  let routeStops = getRouteStops(departure.routeName).slice(0)

  if (departure.type === 'vline' && routeStops.includes('Southern Cross')) {
    if (departure.direction === 'Down') return routeStops
    else return routeStops.reverse()
  } else if (departure.routeName === 'City Circle') {
    return departure.allStops
  } else {
    let departureCityStops = departure.allStops.filter(stop => cityStations.includes(stop))
    if (northernGroup.includes(departure.routeName)) {
      // Express SSS during Night Network
      if (departureCityStops[0] === 'Flinders Street' && departureCityStops.length === 1) {
        if (departure.direction === 'Down') {
          return ['Flinders Street', 'Southern Cross', ...routeStops]
        } else {
          return [...routeStops.reverse(), 'Southern Cross', 'Flinders Street']
        }
      }
    }

    if (departure.direction === 'Down') {
      return [...departureCityStops, ...routeStops]
    } else {
      return [...routeStops.reverse(), ...departureCityStops]
    }
  }
}

function findFutureRouteStops(departure) {
  let startIndex = departure.routeStops.indexOf(departure.futureStops[0])
  let endIndex = departure.routeStops.indexOf(departure.futureStops[departure.futureStops.length - 1])
  let relevantRouteStops = departure.routeStops.slice(startIndex, endIndex + 1)

  return relevantRouteStops
}

function filterPlatform(departures, platform) {
  if (platform === '*') return departures
  return departures.filter(departure => departure.platform === platform)
}

function findExpressSections(departure) {
  let expressSections = []

  let lastMainMatch = 0
  let expressStops = 0

  for (let scheduledStop of departure.futureStops) {
    let matchIndex = -1

    for (let stop of departure.futureRouteStops) {
      matchIndex++

      if (stop === scheduledStop) {

        if (matchIndex !== lastMainMatch) { // there has been a jump - exp section
          let expressPart = departure.futureRouteStops.slice(lastMainMatch, matchIndex)
          expressSections.push(expressPart)
        }

        lastMainMatch = matchIndex + 1
        break
      }
    }
  }

  return expressSections
}

function getStoppingText(departure, stoppingText) {
  let { expressSections, routeStops } = departure
  let destination = departure.futureStops[departure.futureStops.length - 1]
  let currentStation = departure.futureStops[0]

  if (expressSections.length === 0) return stoppingText.stopsAll
  if (expressSections.length === 1 && expressSections[0].length === 1) return stoppingText.allExcept.format(expressSections[0][0])

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

async function getPIDData(station, platform, textOptions, db) {
  let allDepartures = await getAllDeparturesFromStation(station, db)
  let trainDepartures = allDepartures.filter(departure => !departure.isRailReplacementBus)
  let busDepartures = allDepartures.filter(departure => departure.isRailReplacementBus)
  let routesWithBuses = busDepartures.map(departure => departure.routeName).filter((e, i, a) => a.indexOf(e) === i)

  if (!textOptions.stoppingText) textOptions.stoppingText = defaultStoppingText
  if (!textOptions.stoppingType) textOptions.stoppingType = defaultStoppingType

  let platformDepartures = filterPlatform(trainDepartures, platform)
  platformDepartures.forEach(departure => {
    departure.routeStops = getRouteStopsForDeparture(departure)
    departure.futureRouteStops = findFutureRouteStops(departure)
    departure.expressSections = findExpressSections(departure)
    departure.stoppingText = getStoppingText(departure, textOptions.stoppingText)
  })

  return platformDepartures
}

module.exports = {
  getPIDData
}
