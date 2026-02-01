import getRouteStops from '../../../additional-data/route-stops.mjs'
import getMetroDepartures from '../../../modules/metro-trains/get-departures.mjs'
import getVLineDepartures from '../../../modules/vline/get-departures.mjs'
import utils from '../../../utils.mjs'
import async from 'async'
import { getDayOfWeek } from '../../../public-holidays.mjs'
import metroTypes from '../../../additional-data/metro-tracker/metro-types.json' with { type: 'json' }

let undergroundLoopStations = ['Parliament', 'Flagstaff', 'Melbourne Central']
let cityLoopStations = [...undergroundLoopStations, 'Southern Cross']
let cityStations = [...cityLoopStations, 'Flinders Street']

let mainLine = ['Paisley', 'Galvin']
let altonaLoop = ['Seaholme', 'Altona', 'Westona']

let northernGroup = ['Craigieburn', 'Sunbury', 'Upfield', 'Showgrounds/Flemington', 'Flemington Racecourse', 'Werribee', 'Williamstown']

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
  noSuburban: 'No Suburban Passengers',
  notTakingPax: 'Not Taking Passengers',
  // vlinePostfix: ', Not Taking Suburban Passengers',
  stopsAll: 'Stops All',
  limitedExpress: 'Limited Express',
  express: 'Express'
}

async function getAllDeparturesFromStation(station, db) {
  if (!station) return []

  let departures = await utils.getData('pid-combined-departures', station.stopName, async () => {
    let vlineDepartures = []
    let metroDepartures = []
    let stationName = station.stopName.slice(0, -16)
    let timetables = db.getCollection('timetables')

    await Promise.all([
      new Promise(async resolve => {
        return resolve()
        try {
          let vlinePlatform = station.bays.find(bay => bay.mode === 'regional train')
          if (vlinePlatform) {
            let rawVlineDepartures = await getVLineDepartures(station, db)
            vlineDepartures = rawVlineDepartures.map(departure => {
              let routeName = departure.shortRouteName || departure.trip.routeName

              if (routeName === 'Bendigo' && departure.allStops.includes('Eaglehawk')) routeName = 'Swan Hill'
              let currentStop = departure.trip.stopTimings.find(stop => stop.stopName === station.stopName)
              let cancelledStops = departure.trip.stopTimings.filter(stop => stop.cancelled).map(stop => stop.stopName.slice(0, -16))

              let runningFutureStops = departure.futureStops.filter(stop => !cancelledStops.includes(stop))
              let runningAllStops = departure.allStops.filter(stop => !cancelledStops.includes(stop))

              return {
                routeName,
                origin: departure.trip.origin.slice(0, -16),
                destination: departure.destination,
                scheduledDepartureTime: departure.scheduledDepartureTime,
                estimatedDepartureTime: departure.estimatedDepartureTime,
                actualDepartureTime: departure.actualDepartureTime,
                futureStops: [stationName, ...runningFutureStops],
                allStops: runningAllStops,
                direction: departure.trip.direction,
                isRailReplacementBus: departure.isRailReplacementBus,
                platform: departure.platform ? departure.platform.replace(/[?A-Z]/g, '') : '',
                type: 'vline',
                takingPassengers: departure.takingPassengers,
                stopTimings: departure.trip.stopTimings,
                cancelled: departure.cancelled,
                connections: [],
                tdn: departure.runID,
                consist: { size: 0, type: 'Unknown' },
                formedBy: null,
                forming: null
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
            metroDepartures = await async.map(rawMetroDepartures, async departure => {
              let futureStops = departure.futureStops.slice(0)
              let allStops = departure.allStops.slice(0)
              let { destination, routeName } = departure
              let direction = departure.trip.direction

              if (departure.formingTrip) {
                destination = departure.formingDestination
                routeName = departure.formingTrip.routeName
                futureStops = futureStops.concat(departure.futureFormingStops.slice(1))
                allStops = allStops.concat(departure.futureFormingStops.slice(1))
                direction = departure.formingTrip.direction
              }

              if (routeName === 'City Circle') {
                if (stationName === 'Flinders Street') destination = 'City Loop'
                else destination = 'Flinders Street'
              }

              let { runID } = departure
              let today = await getDayOfWeek(departure.departureDayMoment)
              let scheduledTrip = await timetables.findDocument({
                runID, operationDays: today
              })
              let connections = []

              if (scheduledTrip) {
                connections = scheduledTrip.connections.filter(connection => {
                  return departure.futureStops.slice(1).includes(connection.changeAt.slice(0, -16))
                })
              } else connections = []

              let consist = { size: 0, type: 'Unknown', cars: [] }

              let { fleetNumber } = departure
              if (fleetNumber) {
                let matchingSet = metroTypes[fleetNumber[0]]
                if (matchingSet) {
                  consist = {
                    size: fleetNumber.length,
                    type: matchingSet.type,
                    cars: fleetNumber
                  }
                }
              }

              return {
                operationDay: departure.departureDay,
                routeName,
                origin: departure.origin,
                destination,
                scheduledDepartureTime: departure.scheduledDepartureTime,
                estimatedDepartureTime: departure.estimatedDepartureTime,
                actualDepartureTime: departure.actualDepartureTime,
                futureStops: [stationName, ...futureStops],
                allStops: allStops,
                direction: direction,
                isRailReplacementBus: departure.isRailReplacementBus,
                platform: departure.platform ? departure.platform.replace(/[?A-Z]/g, '') : '',
                type: 'metro',
                takingPassengers: true,
                stopTimings: departure.trip.stopTimings,
                cancelled: departure.cancelled,
                connections,
                tdn: departure.runID,
                consist,
                formedBy: departure.trip.formedBy,
                forming: departure.trip.forming
              }
            })
          }
        } finally {
          resolve()
        }
      })
    ])

    return [...metroDepartures, ...vlineDepartures]
  }, 1000 * 30)

  let now = utils.now()
  return departures.filter(departure => {
    let timeDifference = departure.actualDepartureTime.diff(now, 'seconds')
    return -30 <= timeDifference && timeDifference <= 120 * 60
  })
}


async function getStationArrivals(station, db) {
  if (!station) return []

  let arrivals = await utils.getData('pid-arrivals', station.stopName, async () => {
    let allServices = await getMetroDepartures(station, db, false, false, null, { returnArrivals: true })
    let arrivals = allServices.filter(departure => departure.isArrival)

    // No forming trip means its ETY
    let shunts = arrivals.filter(arrival => !arrival.formingTrip)

    return shunts.map(shunt => {
      let scheduledDepartureTime = shunt.scheduledDepartureTime.clone().add(5, 'minutes')
      let estimatedDepartureTime = shunt.estimatedDepartureTime ? shunt.estimatedDepartureTime.clone().add(5, 'minutes') : null

      return {
        routeName: shunt.routeName,
        destination: 'Arrival',
        scheduledDepartureTime,
        estimatedDepartureTime,
        actualDepartureTime: estimatedDepartureTime || scheduledDepartureTime,
        futureStops: [],
        allStops: [],
        direction: shunt.formingRunID ? (parseInt(shunt.formingRunID[3]) % 2 === 0 ? 'Up' : 'Down') : 'Down',
        isRailReplacementBus: false,
        platform: shunt.platform,
        type: 'metro',
        takingPassengers: false,
        stopTimings: [],
        connections: [],
        operationDay: shunt.trip.operationDays,
        formedBy: shunt.runID,
        tdn: shunt.formingRunID,
      }
    })
  }, 1000 * 30)

  let now = utils.now()
  return arrivals.filter(arrival => {
    let timeDifference = arrival.actualDepartureTime.diff(now, 'seconds')
    return -30 <= timeDifference && timeDifference <= 120 * 60
  })
}

function getRouteStopsForDeparture(departure) {
  let routeStops = getRouteStops(departure.routeName).slice(0)
  if (departure.routeName === 'Geelong' && (
    departure.allStops.includes('Werribee') || departure.allStops.includes('Newport')
  )) {
    routeStops = getRouteStops('Werribee').slice(0)
  }

  let allStops = departure.stopTimings.map(stop => stop.stopName.slice(0, -16))
  if (departure.type === 'vline') {
    let fullRouteStops
    if (['Traralgon', 'Bairnsdale'].includes(departure.routeName)) {
      fullRouteStops = ['Southern Cross', 'Flinders Street', ...routeStops]
    } else {
      fullRouteStops = ['Southern Cross', ...routeStops]
    }

    if (departure.direction === 'Down') return fullRouteStops
    else return fullRouteStops.reverse()
  } else if (departure.routeName === 'City Circle') {
    return allStops
  } else {
    let departureCityStops = allStops.filter(stop => cityStations.includes(stop))
    if (northernGroup.includes(departure.routeName)) {
      // Express SSS during Night Network
      if (departureCityStops[0] === 'Flinders Street' && departureCityStops.length === 1 && parseInt(departure.tdn[1]) < 6) {
        if (departure.direction === 'Down') {
          return ['Flinders Street', 'Southern Cross', ...routeStops]
        } else {
          return [...routeStops.reverse(), 'Southern Cross', 'Flinders Street']
        }
      }
    }
    
    let cityStops = []

    if (northernGroup.includes(departure.routeName)) {
      if (departureCityStops.includes('Parliament')) { // VL
        cityStops = ['Southern Cross', 'Flinders Street', 'Parliament', 'Melbourne Central', 'Flagstaff']
      } else { // Direct
        cityStops = ['Flinders Street', 'Southern Cross']
      }
      if (!departureCityStops.includes('Flinders Street')) cityStops.shift() // In case starts at SSS
    } else {
      if (departureCityStops.includes('Southern Cross')) { // VL
        cityStops = ['Flinders Street', 'Southern Cross', 'Flagstaff', 'Melbourne Central', 'Parliament']
      } else { // Direct
        cityStops = ['Flinders Street']
      }
    }

    let firstCityStop = departureCityStops[0], lastCityStop = departureCityStops[departureCityStops.length - 1]

    let firstIndex = cityStops.indexOf(firstCityStop)
    let lastIndex = cityStops.indexOf(lastCityStop)
    if (firstIndex > lastIndex) cityStops.reverse()

    if (departure.direction === 'Down') {
      return [...cityStops, ...routeStops]
    } else {
      return [...routeStops.reverse(), ...cityStops]
    }
  } 
}

function checkAltonaRunning(departure) {
  if (departure.routeName === 'Werribee') {
    if (departure.allStops.includes('Altona')) {
      departure.routeStops = departure.routeStops.filter(e => !mainLine.includes(e))
    } else {
      departure.routeStops = departure.routeStops.filter(e => !altonaLoop.includes(e))
    }
  }
}

function findFutureRouteStops(departure) {
  let startIndex = departure.routeStops.indexOf(departure.futureStops[0])
  let endIndex = departure.routeStops.lastIndexOf(departure.futureStops[departure.futureStops.length - 1])
  let relevantRouteStops = departure.routeStops.slice(startIndex, endIndex + 1)

  return relevantRouteStops
}

function filterPlatform(departures, platform) {
  if (platform === 'U') return departures.filter(departure => departure.direction === 'Up')
  else if (platform === 'D') return departures.filter(departure => departure.direction === 'Down')
  else if (platform === '*') return departures
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

function getScreenStops(departure) {
  let trainPassesBy = departure.futureRouteStops
  let trainStops = departure.futureStops

  let screenStops = trainPassesBy.map(stop => ({
    stopName: stop,
    express: !trainStops.includes(stop)
  }))

  return screenStops
}

function getExpressCount(departure) {
  return departure.expressSections.reduce((a, e) => a.concat(e), []).length
}

function appendStoppingType(departure, stoppingTypes) {
  let { expressCount } = departure

  if (departure.destination === 'Arrival') {
    departure.stoppingType = stoppingTypes.notTakingPax
  } else if (departure.type === 'vline' && stoppingTypes.noSuburban) {
    departure.stoppingType = stoppingTypes.noSuburban

    if (stoppingTypes.vlinePostfix) {
      departure.stoppingText += stoppingTypes.vlinePostfix
    }
  } else if (expressCount === 0) departure.stoppingType = stoppingTypes.stopsAll
  else if (expressCount < 4) departure.stoppingType = stoppingTypes.limitedExpress
  else departure.stoppingType = stoppingTypes.express
}

function findVia(departure) {
  let { futureStops, type } = departure
  if (type === 'vline') return ''

  let stopsUpToDest = futureStops.slice(0, -1)

  let currentStop = futureStops[0]
  let destination = futureStops[futureStops.length - 1]

  let rmdIndex = stopsUpToDest.indexOf('Richmond')
  let jliIndex = stopsUpToDest.indexOf('Jolimont')
  let sssIndex = stopsUpToDest.indexOf('Southern Cross')
  let fgsIndex = stopsUpToDest.indexOf('Flagstaff')
  let fssIndex = stopsUpToDest.indexOf('Flinders Street')

  if (currentStop === 'Flinders Street') {
    if (northernGroup.includes(departure.routeName)) {
      if (sssIndex !== -1) return 'Sthn Cross'
      if (fgsIndex !== -1) return 'City Loop'
    } else {
      if (fgsIndex !== -1) return 'City Loop'
      if (sssIndex !== -1) return 'Sthn Cross'
      if (jliIndex !== -1) return 'Jolimont'
    }

    if (rmdIndex !== -1) return 'Richmond'
  } else if (cityLoopStations.includes(currentStop)) {
    if (fssIndex !== -1 && destination !== 'Flinders Street') return 'Flinders St'
  } else {
    if (northernGroup.includes(departure.routeName)) {
      if (sssIndex !== -1) return 'Sthn Cross'
    } else {
      if (departure.destination === 'City Loop' && rmdIndex !== -1) return 'Richmond'
      else if (jliIndex !== -1) return 'Jolimont'
    }
  }

  return ''
}

function trimDepartures(departures, includeStopTimings) {
  let platformsSeen = []

  return departures.map((departure, i) => {
    let currentStop = departure.futureStops[0]
    let delay = departure.estimatedDepartureTime ? Math.round((departure.estimatedDepartureTime - departure.scheduledDepartureTime) / 60000) : 0

    let stops = []
    if (!platformsSeen.includes(departure.platform)) {
      platformsSeen.push(departure.platform)
      stops = departure.screenStops.map(stop => [stop.stopName, stop.express])
    }

    let data = {
      dest: departure.destination,
      sch: departure.scheduledDepartureTime,
      est: departure.estimatedDepartureTime,
      plt: departure.platform,
      txt: departure.stoppingText,
      type: departure.stoppingType,
      route: departure.routeName,
      stops,
      via: departure.via,
      p: departure.takingPassengers ? 1 : 0,
      d: departure.direction === 'Up' ? 'U' : 'D',
      v: departure.type === 'vline' ? 1 : 0,
      times: [],
      c: departure.connections.map(connection => ({ f: connection.for.slice(0, -16), a: connection.changeAt.slice(0, -16) })),
      dly: delay,
      t: departure.tdn
    }

    if (includeStopTimings) {
      let hasSeenStop = false

      data.times = departure.stopTimings.filter(stop => {
        if (hasSeenStop) return true
        if (stop.stopName.slice(0, -16) === currentStop) {
          hasSeenStop = true
          return true
        }
        return false
      }).map(stop => ({
        name: stop.stopName.slice(0, -16),
        time: stop.departureTimeMinutes || stop.arrivalTimeMinutes
      }))
    }

    return data
  })
}

export async function getPIDData(station, platform, options, db) {
  let { dep, has, bus } = await utils.getData('pid-data', station.stopName, async () => {
    let departures = []
    let arrivals = []

    await Promise.all([
      new Promise(async resolve => {
        try {
          departures = await getAllDeparturesFromStation(station, db)
        } finally {
          resolve()
        }
      }),
      new Promise(async resolve => {
        try {
          arrivals = await getStationArrivals(station, db)
        } finally {
          resolve()
        }
      })
    ])

    let trainDepartures = departures.filter(departure => !departure.isRailReplacementBus).filter(departure => {
      return !departure.cancelled || options.includeCancelled
    })

    let busDepartures = departures.filter(departure => departure.isRailReplacementBus)
    let routesWithBuses = busDepartures.map(departure => departure.routeName).filter((e, i, a) => a.indexOf(e) === i)

    if (!options.stoppingText) options.stoppingText = defaultStoppingText
    if (!options.stoppingType) options.stoppingType = defaultStoppingType
    if (!options.maxDepartures) options.maxDepartures = 5

    let allDepartures = [...trainDepartures, ...arrivals].sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
    if (allDepartures[0] && allDepartures[0].destination === 'Arrival') {
      allDepartures = [allDepartures[0], ...trainDepartures]
    } else {
      allDepartures = allDepartures.filter(departure => departure.destination !== 'Arrival')
    }

    allDepartures.forEach(departure => {
      departure.routeStops = getRouteStopsForDeparture(departure)
      checkAltonaRunning(departure)

      departure.futureRouteStops = findFutureRouteStops(departure)
      departure.expressSections = findExpressSections(departure)
      departure.stoppingText = getStoppingText(departure, options.stoppingText)
      departure.screenStops = getScreenStops(departure)
      departure.expressCount = getExpressCount(departure)
      departure.via = findVia(departure)

      appendStoppingType(departure, options.stoppingType)
    })

    return { dep: allDepartures, has: trainDepartures.length > 0, bus: routesWithBuses }
  })

  let platformTrains = filterPlatform(dep, platform)

  return {
    dep: options.rawDepartures ? platformTrains : trimDepartures(platformTrains, options.includeStopTimings),
    has,
    bus
  }
}

export async function getStation(stationName, db) {
  return await utils.getData('pid-station', stationName, async () => {
    return await db.getCollection('stops').findDocument({
      cleanName: stationName + '-railway-station'
    })
  }, 1000 * 60 * 60)
}

export function getURL(station, pid) {
  let pidURL
  if (pid.concourse) {
    pidURL = `/mockups/metro-lcd/concourse/${station}/${pid.type}${pid.query ? '?' + pid.query : ''}`
  }

  if (pid.type === 'platform') pidURL = `/pid/metro-lcd/full-pid#s=${station}&p=${pid.platform}&t=platform${typeof pid.capacity !== 'undefined' ? `&cap=${pid.capacity}` : ''}`
  if (pid.type === 'pre-plat-landscape') pidURL = `/pid/metro-lcd/full-pid#s=${station}&p=${pid.platform}&t=pre-plat-landscape`
  if (pid.type === 'pre-plat-portrait') pidURL = `/pid/metro-lcd/full-pid#s=${station}&p=${pid.platform}&t=pre-plat-portrait`
  if (pid.type === 'fss-platform') pidURL = `/pid/metro-lcd/full-pid#s=${station}&p=${pid.platform}&t=platform`
  if (pid.type === 'pre-platform-vertical') pidURL = `/pid/metro-lcd/full-pid#s=${station}&p=${pid.platform}&t=pre-plat-portrait`
  if (pid.type === 'fss-escalator') pidURL = `/pid/metro-lcd/full-pid#s=${station}&p=${pid.platform}&t=pre-plat-portrait`
  if (pid.type === 'half-platform-bold') pidURL = `/pid/metro-lcd/half-platform-bold#s=${station}&p=${pid.platform}`
  if (pid.type === 'half-platform') pidURL = `/pid/metro-lcd/half-platform#s=${station}&p=${pid.platform}`
  if (pid.type === 'psd') pidURL = `/pid/metro-lcd/platform-screen-door#s=${station}&p=${pid.platform}&cap=${pid.capacity}`

  if (pid.type === 'trains-from-fss') pidURL = '/mockups/fss/trains-from-fss'
  // if (pid.type === 'half-platform-bold') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/half-platform-bold`
  // if (pid.type === 'half-platform') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/half-platform`
  // if (pid.type === 'platform') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/platform`
  // if (pid.type === 'pre-platform-vertical') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/pre-platform-vertical`
  if (pid.type === 'vline-half-platform') pidURL = `/mockups/vline/${station}/${pid.platform}`
  // if (pid.type === 'fss-escalator') pidURL = `/mockups/fss/escalator/${pid.platform}/${station}/`
  // if (pid.type === 'fss-platform') pidURL = `/mockups/fss/platform/${pid.platform}/${station}/`
  if (pid.type === 'sss-platform') pidURL = `/mockups/sss/platform/${pid.platform * 2 - 1}-${pid.platform * 2}/`
  if (pid.type === '2-line-led') pidURL = `/mockups/metro-led-pids/${station}/${pid.platform}`
  if (pid.type === 'crt') pidURL = `/mockups/metro-crt/${station}/${pid.platform}`

  return pidURL
}

export default {
  getPIDData,
  getStation,
  getURL
}