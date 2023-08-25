const getRouteStops = require('../../../additional-data/route-stops')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
const destinationOverrides = require('../../../additional-data/coach-stops')
const utils = require('../../../utils')
const async = require('async')
const { getDayOfWeek } = require('../../../public-holidays')
const metroTypes = require('../../../additional-data/metro-tracker/metro-types')
const { encodeTrainType } = require('../../../additional-data/consist-encoder')

let undergroundLoopStations = ['Parliament', 'Flagstaff', 'Melbourne Central']
let cityLoopStations = ['Southern Cross', ...undergroundLoopStations]
let cityStations = [...cityLoopStations, 'Flinders Street']

let mainLine = ['Paisley', 'Galvin']
let altonaLoop = ['Seaholme', 'Altona', 'Westona']

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
                consist: { size: 0, type: 'Unknown' }
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
              let destination = departure.destination
              if (departure.routeName === 'City Circle') {
                if (stationName === 'Flinders Street') destination = 'City Loop'
                else destination = 'Flinders Street'
              }

              let { runID } = departure
              let today = await getDayOfWeek(departure.originDepartureTime)
              let scheduledTrip = await timetables.findDocument({
                runID, operationDays: today
              })
              let connections = []

              if (scheduledTrip) {
                connections = scheduledTrip.connections.filter(connection => {
                  return departure.futureStops.slice(1).includes(connection.changeAt.slice(0, -16))
                })
              } else connections = []

              let consist = { size: 0, type: 'Unknown' }
              let { fleetNumber } = departure
              if (fleetNumber) {
                let matchingSet = metroTypes.find(set => fleetNumber.includes(set.leadingCar))
                if (matchingSet) {
                  consist = {
                    size: fleetNumber.length,
                    type: matchingSet.type
                  }
                }
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
                type: 'metro',
                takingPassengers: true,
                stopTimings: departure.trip.stopTimings,
                cancelled: departure.cancelled,
                connections,
                tdn: departure.runID,
                consist
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
    let stationName = station.stopName.slice(0, -16)
    let metroShunts = db.getCollection('metro shunts')
    let liveTimetables = db.getCollection('live timetables')

    let now = utils.now()
    let startOfDay = now.clone().startOf('day')

    let minutesPastMidnight = utils.getMinutesPastMidnight(now)
    if (minutesPastMidnight < 180) {
      now.add(-3.5, 'hours')
      minutesPastMidnight += 1440
    }

    let date = utils.getYYYYMMDD(now)

    let shunts = await metroShunts.findDocuments({
      date,
      stationName,
      arrivalTimeMinutes: {
        $gte: minutesPastMidnight - 60,
        $lte: minutesPastMidnight + 120
      }
    }).toArray()

    return async.map(shunts, async shunt => {
      let clearTime = 5
      if (shunt.notifyAlert) clearTime = 2

      let departureTime = startOfDay.clone().add(shunt.arrivalTimeMinutes + clearTime, 'minutes')
      let liveTimetable = await liveTimetables.findDocument({
        operationDays: date,
        mode: 'metro train',
        runID: shunt.runID
      })

      let estimatedDepartureTime = null
      if (liveTimetable) {
        let lastStop = liveTimetable.stopTimings[liveTimetable.stopTimings.length - 1]
        if (lastStop.estimatedDepartureTime) {
          let stopEstimated = utils.parseTime(lastStop.estimatedDepartureTime)
          let stopScheduled = utils.parseTime(lastStop.scheduledDepartureTime)

          let difference = Math.max(0, stopEstimated.diff(stopScheduled, 'minutes'))
          estimatedDepartureTime = departureTime.clone().add(difference, 'minutes')
        }
      }

      return {
        routeName: shunt.routeName,
        destination: 'Arrival',
        scheduledDepartureTime: departureTime,
        estimatedDepartureTime,
        actualDepartureTime: estimatedDepartureTime || departureTime,
        futureStops: [],
        allStops: [],
        direction: 'Down',
        isRailReplacementBus: false,
        platform: shunt.platform,
        type: 'metro',
        takingPassengers: false,
        stopTimings: [],
        connections: []
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
  let { futureStops } = departure

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
  return departures.map((departure, i) => {
    let currentStop = departure.futureStops[0]
    let delay = departure.estimatedDepartureTime ? Math.round((departure.estimatedDepartureTime - departure.scheduledDepartureTime) / 60000) : 0

    let data = {
      dest: departure.destination,
      sch: departure.scheduledDepartureTime,
      est: departure.estimatedDepartureTime,
      plt: departure.platform,
      txt: departure.stoppingText,
      type: departure.stoppingType,
      route: departure.routeName,
      stops: i === 0 ? departure.screenStops.map(stop => [stop.stopName, stop.express]) : [],
      via: departure.via,
      p: departure.takingPassengers ? 1 : 0,
      d: departure.direction === 'Up' ? 'U' : 'D',
      v: departure.type === 'vline' ? 1 : 0,
      times: [],
      c: departure.connections.map(connection => ({ f: connection.for.slice(0, -16), a: connection.changeAt.slice(0, -16) })),
      dly: delay,
      t: departure.tdn,
      con: encodeTrainType(departure.consist.size, departure.consist.type)
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

async function getPIDData(station, platform, options, db) {
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
    return !(departure.cancelled || options.includeCancelled)
  })

  let busDepartures = departures.filter(departure => departure.isRailReplacementBus)
  let routesWithBuses = busDepartures.map(departure => departure.routeName).filter((e, i, a) => a.indexOf(e) === i)

  if (!options.stoppingText) options.stoppingText = defaultStoppingText
  if (!options.stoppingType) options.stoppingType = defaultStoppingType
  if (!options.maxDepartures) options.maxDepartures = 5

  let platformDepartures = filterPlatform(trainDepartures, platform)
  let platformArrivals = filterPlatform(arrivals, platform)

  let allDepartures = [...platformDepartures, ...platformArrivals].sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  if (allDepartures[0] && allDepartures[0].destination === 'Arrival') {
    allDepartures = [allDepartures[0], ...platformDepartures]
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

  return {
    dep: options.rawDepartures ? allDepartures : trimDepartures(allDepartures, options.includeStopTimings),
    has: trainDepartures.length > 0,
    bus: routesWithBuses
  }
}

async function getStation(stationName, db) {
  return await utils.getData('pid-station', stationName, async () => {
    return await db.getCollection('stops').findDocument({
      codedName: stationName + '-railway-station'
    })
  }, 1000 * 60 * 60)
}

function getURL(station, pid) {
  let pidURL
  if (pid.concourse) {
    pidURL = `/mockups/metro-lcd/concourse/${station}/${pid.type}${pid.query ? '?' + pid.query : ''}`
  }

  if (pid.type === 'trains-from-fss') pidURL = '/mockups/fss/trains-from-fss'
  if (pid.type === 'half-platform-bold') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/half-platform-bold`
  if (pid.type === 'half-platform') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/half-platform`
  if (pid.type === 'platform') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/platform`
  if (pid.type === 'pre-platform-vertical') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/pre-platform-vertical`
  if (pid.type === 'vline-half-platform') pidURL = `/mockups/vline/${station}/${pid.platform}`
  if (pid.type === 'fss-escalator') pidURL = `/mockups/fss/escalator/${pid.platform}/${station}/`
  if (pid.type === 'fss-platform') pidURL = `/mockups/fss/platform/${pid.platform}/${station}/`
  if (pid.type === 'sss-platform') pidURL = `/mockups/sss/platform/${pid.platform * 2 - 1}-${pid.platform * 2}/`
  if (pid.type === '2-line-led') pidURL = `/mockups/metro-led-pids/${station}/${pid.platform}`
  if (pid.type === 'crt') pidURL = `/mockups/metro-crt/${station}/${pid.platform}`

  return pidURL
}

module.exports = {
  getPIDData,
  getStation,
  getURL
}
