const getLineStops = require('./route-stops')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
const utils = require('../../../utils')

let defaultStoppingMap = {
  stopsAll: 'Stops All Stations',
  allExcept: 'All Except {0}',
  expressAtoB: '{0} to {1}',
  sasAtoB: 'Stops All Stations from {0} to {1}',
  runsExpressAtoB: 'Runs Express from {0} to {1}',
  runsExpressTo: 'Runs Express to {0}',
  thenRunsExpressAtoB: 'then Runs Express from {0} to {1}',
  sasTo: 'Stops All Stations to {0}',
  thenSASTo: 'then Stops All Stations to {0}'
}

let northernGroup = [
  'Craigieburn',
  'Sunbury',
  'Upfield',
  'Werribee',
  'Williamstown',
  'Showgrounds/Flemington'
]

let crossCityGroup = [
  'Werribee',
  'Williamstown',
  'Frankston'
]

let gippslandLines = [
  'Bairnsdale',
  'Traralgon'
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']


module.exports = {
  getCombinedDepartures: async (station, db) => {
    let vlineDepartures = [], metroDepartures = []

    try {
      vlineDepartures = (await getVLineDepartures(station, db)).map(departure => {
        if (departure.platform)
          departure.platform = departure.platform.replace('?', '')
        departure.type = 'vline'
        departure.actualDepartureTime = departure.scheduledDepartureTime

        return departure
      })
    } catch (e) {}

    try {
      metroDepartures = (await getMetroDepartures(station, db, 15, true))
    } catch (e) {}

    let departures = [...metroDepartures, ...vlineDepartures].filter(departure => {
      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')

      return !departure.cancelled && minutesDifference < 120 && secondsDifference >= -20 // minutes round down
    })

    return departures.sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  },
  addTimeToDeparture: departure => {
    let timeDifference = departure.actualDepartureTime.diff(utils.now(), 'minutes')
    departure.minutesToDeparture = timeDifference

    if (+timeDifference <= 0) departure.prettyTimeToDeparture = 'NOW'
    else {
      departure.prettyTimeToDeparture = timeDifference + ' min'
    }
    return departure
  },
  appendScreenDataToDeparture: (departure, station) => {
    departure = module.exports.addTimeToDeparture(departure)
    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    let lineStops = getLineStops(departure.shortRouteName || departure.trip.routeName)
    let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

    if (departure.forming) {
      let prevTripCityLoop = tripStops.filter(e => cityLoopStations.includes(e))
      tripStops = [...prevTripCityLoop, ...departure.forming.stopTimings.map(stop => stop.stopName.slice(0, -16))]
      tripStops = tripStops.filter((e, i, a) => a.indexOf(e) === i)

      lineStops = getLineStops(departure.forming.routeName)
    }

    lineStops = lineStops.slice(0)

    // If there's a forming then consider it as a down trip
    let isFormingNewTrip = !!departure.forming
    let isUp = departure.trip.direction === 'Up' && !isFormingNewTrip
    let destination = isFormingNewTrip ? departure.destination : departure.trip.destination
    destination = destination.replace(' Railway Station', '') // TODO:  fix
    if (destination === 'Parliament') destination = 'Flinders Street'

    if (isUp) {
      lineStops = lineStops.reverse()

      let hasSeenFSS = false
      tripStops = tripStops.filter(e => {
        if (hasSeenFSS) return false
        if (e === 'Flinders Street') {
          hasSeenFSS = true
        }
        return true
      })
    }

    let stationName = station.stopName.slice(0, -16)
    let relevantTrip = departure.forming || departure.trip
    let routeName = departure.shortRouteName || relevantTrip.routeName

    let startingIndex = tripStops.indexOf(stationName)
    let viaCityLoop = tripStops.includes('Flagstaff')
    tripStops = tripStops.slice(startingIndex)

    if (viaCityLoop) {
      let cityLoopStops = tripStops.filter(e => cityLoopStations.includes(e))
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e))

      if (isUp) {
        lineStops = lineStops.slice(0, -1).concat(cityLoopStops)
        lineStops.push('Flinders Street')
      } else {
        lineStops = ['Flinders Street', ...cityLoopStops, ...lineStops.slice(1)]
      }
    } else if (departure.type === 'vline') {
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e) && e !== 'Flinders Street')
      if (gippslandLines.includes(routeName))
        lineStops = ['Southern Cross', 'Flinders Street', ...lineStops]
      else
        lineStops = ['Southern Cross', ...lineStops]
    } else {
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e))

      if (northernGroup.includes(routeName)) {
        if (isUp) {
          lineStops = [...lineStops.slice(0, -1), 'Southern Cross', 'Flinders Street']
        } else {
          lineStops = ['Flinders Street', 'Southern Cross', ...lineStops.slice(1)]
        }
      } else if (routeName === 'Frankston') {
        if (isUp) {
          lineStops = [...lineStops.slice(0, -1), 'Flinders Street', 'Southern Cross']
        } else {
          lineStops = ['Southern Cross', 'Flinders Street', ...lineStops.slice(1)]
        }
      }
    }

    startingIndex = lineStops.indexOf(stationName)
    let endingIndex = lineStops.indexOf(destination)

    let tripPassesBy = lineStops.slice(startingIndex, endingIndex + 1)

    if (viaCityLoop) {
      if (northernGroup.includes(routeName)) {
        if (isFormingNewTrip && stationName === 'Southern Cross') {
          tripPassesBy = [
            'Southern Cross', 'Flinders Street', ...tripPassesBy.slice(1)
          ]
        }
      }
    } else {
      if (northernGroup.includes(routeName)) {
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop) || stop === 'Southern Cross')
      } else if (departure.type !== 'vline') {
        tripPassesBy = tripPassesBy.filter(stop => !cityLoopStations.includes(stop))
      }

      if (crossCityGroup.includes(relevantTrip.routeName) && isFormingNewTrip && stationName === 'Southern Cross') {
        tripPassesBy = ['Southern Cross', ...tripPassesBy]
      }
    }

    let screenStops = tripPassesBy.map(stop => {
      return {
        stopName: stop,
        isExpress: !tripStops.includes(stop)
      }
    })

    if (!screenStops.length) return null
    let expressCount = screenStops.filter(stop => stop.isExpress).length

    let additionalInfo = {
      screenStops, expressCount, viaCityLoop, direction: isUp ? 'Up': 'Down'
    }

    departure.additionalInfo = additionalInfo

    return departure
  },
  findExpressStops: (stopTimings, routeStops, routeName, isUp, isVLine, stationName) => {
    // TODO: REFACTOR
    if (isUp) {
      let hasSeenFSS = false
      stopTimings = stopTimings.filter(e => {
        if (hasSeenFSS) return false
        if (e === 'Flinders Street') {
          hasSeenFSS = true
        }
        return true
      })
    } else {
      let hasFSS = stopTimings.includes('Flinders Street')
      if (hasFSS) {
        let hasSeenFSS = false
        stopTimings = stopTimings.filter(e => {
          if (hasSeenFSS) return true
          if (e === 'Flinders Street') {
            hasSeenFSS = true
            return true
          }
          return false
        })
      }
    }

    let viaCityLoop = stopTimings.includes('Flagstaff')

    if (!viaCityLoop) {
      routeStops = routeStops.filter(stop => !cityLoopStations.includes(stop))
      if (northernGroup.includes(routeName) || isVLine) {
        if (isUp) {
          routeStops = [...routeStops.slice(0, -1), 'Southern Cross', 'Flinders Street']
        } else {
          routeStops = ['Flinders Street', 'Southern Cross', ...routeStops.slice(1)]
        }
      }
    } else {
      let cityLoopStops = stopTimings.filter(e => cityLoopStations.includes(e))
      routeStops = routeStops.filter(e => !cityLoopStations.includes(e))

      if (isUp) {
        routeStops = routeStops.slice(0, -1).concat(cityLoopStops)
        routeStops.push('Flinders Street')
      } else {
        routeStops = ['Flinders Street', ...cityLoopStops, ...routeStops.slice(1)]
      }
    }

    let startIndex = stopTimings.indexOf(stationName)
    let endIndex = stopTimings.length

    if (isUp) {
      let fssIndex = stopTimings.indexOf('Flinders Street')
      if (fssIndex !== -1)
        endIndex = fssIndex
    }

    stopTimings = stopTimings.slice(startIndex, endIndex + 1)

    let firstStop = stopTimings[0]
    let lastStop = stopTimings.slice(-1)[0]

    let firstStopIndex = routeStops.indexOf(firstStop)
    let lastStopIndex = routeStops.indexOf(lastStop) + 1
    let relevantStops = routeStops.slice(firstStopIndex, lastStopIndex)

    let expressParts = []

    let lastMainMatch = 0
    let expressStops = 0

    for (let scheduledStop of stopTimings) {
      let matchIndex = -1

      for (let stop of relevantStops) {
        matchIndex++

        if (stop === scheduledStop) {

          if (matchIndex !== lastMainMatch) { // there has been a jump - exp section
            let expressPart = relevantStops.slice(lastMainMatch, matchIndex)
            expressParts.push(expressPart)
          }

          lastMainMatch = matchIndex + 1
          break
        }
      }
    }

    return expressParts
  },
  determineStoppingPattern: (expressParts, destination, routeStops, currentStation, textMap=defaultStoppingMap) => {
    if (expressParts.length === 0) return textMap.stopsAll
    if (expressParts.length === 1 && expressParts[0].length === 1) return textMap.allExcept.format(expressParts[0][0])
    let texts = []

    let lastStop = null

    expressParts.forEach((expressSection, i) => {
      let firstExpressStop = expressSection[0]
      let lastExpressStop = expressSection.slice(-1)[0]

      let previousStop = routeStops[routeStops.indexOf(firstExpressStop) - 1]
      let nextStop = routeStops[routeStops.indexOf(lastExpressStop) + 1]

      if (lastStop) {
        if (i === expressParts.length - 1 && nextStop === destination) {
          texts.push(textMap.thenRunsExpressAtoB.format(previousStop, nextStop))
        } if (lastStop === previousStop) {
          texts.push(textMap.expressAtoB.format(previousStop, nextStop))
        } else {
          texts.push(textMap.sasAtoB.format(lastStop, previousStop))
          texts.push(textMap.runsExpressAtoB.format(previousStop, nextStop))
        }
      } else {
        if (currentStation === previousStop) {
          texts.push(textMap.runsExpressTo.format(nextStop))
        } else {
          texts.push(textMap.sasTo.format(previousStop))
          texts.push(textMap.runsExpressAtoB.format(previousStop, nextStop))
        }
      }

      lastStop = nextStop
    })

    if (routeStops[routeStops.indexOf(lastStop) + 1] !== destination) {
      texts.push(textMap.thenSASTo.format(destination))
    }

    return texts.join(', ').replace(/ Railway Station/g, '')
  },
  filterPlatforms: (departures, platform) => {
    let shouldFilterPlatform = platform !== '*'
    if (!shouldFilterPlatform) return departures

    return departures.filter(departure => {
      if (departure.type === 'vline') {
        if (!departure.platform) return null
        let mainPlatform = departure.platform.replace(/[A-Z]/, '')
        return mainPlatform === platform
      } else {
        return departure.platform === platform
      }
    })
  }
}
