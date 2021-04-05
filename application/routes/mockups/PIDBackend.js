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
                platform: departure.platform.replace(/[?A-Z]/g, ''),
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
              return {
                routeName: departure.routeName,
                destination: departure.destination,
                scheduledDepartureTime: departure.scheduledDepartureTime,
                estimatedDepartureTime: departure.estimatedDepartureTime,
                actualDepartureTime: departure.actualDepartureTime,
                futureStops: [stationName, ...departure.futureStops],
                allStops: departure.allStops,
                direction: departure.trip.direction,
                isRailReplacementBus: departure.isRailReplacementBus,
                platform: departure.platform,
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

async function getPIDData(station, platform, db) {
  let allDepartures = await getAllDeparturesFromStation(station, db)
  let trainDepartures = allDepartures.filter(departure => !departure.isRailReplacementBus)
  let busDepartures = allDepartures.filter(departure => departure.isRailReplacementBus)
  let routesWithBuses = busDepartures.map(departure => departure.routeName).filter((e, i, a) => a.indexOf(e) === i)

  let platformDepartures = filterPlatform(trainDepartures, platform)
  platformDepartures.forEach(departure => {
    departure.routeStops = getRouteStopsForDeparture(departure)
    departure.findFutureRouteStops = findFutureRouteStops(departure)
  })

  return platformDepartures
}

module.exports = {
  getPIDData
}
