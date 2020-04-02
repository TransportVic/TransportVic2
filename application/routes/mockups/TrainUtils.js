const getLineStops = require('./route-stops')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
const utils = require('../../../utils')

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
      vlineDepartures = (await getVLineDepartures(station, db))
        .map(departure => {
          departure.platform = departure.platform.replace('?', '')
          departure.type = 'vline'

          return departure
        }).filter(departure => {
          let diff = departure.actualDepartureTime
          let minutesDifference = diff.diff(utils.now(), 'minutes')
          let secondsDifference = diff.diff(utils.now(), 'seconds')

          return minutesDifference < 120 && secondsDifference >= 10 // minutes round down
        })
    } catch (e) {}

    try {
      metroDepartures = (await getMetroDepartures(station, db, 15, true))
      .filter(departure => {
        if (departure.cancelled) return false

        let diff = departure.actualDepartureTime
        let minutesDifference = diff.diff(utils.now(), 'minutes')
        let secondsDifference = diff.diff(utils.now(), 'seconds')
        return minutesDifference < 120 && secondsDifference >= 10 // minutes round down
      })
    } catch (e) {}

    return [...metroDepartures, ...vlineDepartures]
  },
  addTimeToDeparture: departure => {
    let timeDifference = departure.actualDepartureTime.diff(utils.now(), 'minutes')

    if (+timeDifference <= 0) departure.prettyTimeToDeparture = 'NOW'
    else {
      departure.prettyTimeToDeparture = timeDifference + ' min'
    }
    return departure
  },
  appendScreenDataToDeparture: (departure, station) => {
    departure = module.exports.addTimeToDeparture(departure)
    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    let lineStops = getLineStops(departure.trip.shortRouteName || departure.trip.routeName)
    let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

    if (departure.forming) {
      let prevTripCityLoop = tripStops.filter(e => cityLoopStations.includes(e))
      tripStops = [...prevTripCityLoop, ...departure.forming.stopTimings.map(stop => stop.stopName.slice(0, -16))]
      tripStops = tripStops.filter((e, i, a) => a.indexOf(e) === i)

      lineStops = getLineStops(departure.forming.shortRouteName || departure.forming.routeName)
    }

    lineStops = lineStops.slice(0)

    // If there's a forming then consider it as a down trip
    let isFormingNewTrip = !!departure.forming
    let isUp = departure.trip.direction === 'Up' && !isFormingNewTrip
    let destination = isFormingNewTrip ? departure.destination : departure.trip.destination

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
    let routeName = relevantTrip.shortRouteName || relevantTrip.routeName

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
      routeStops = routeStops.slice(0).reverse()
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
  determineStoppingPattern: (expressParts, destination, routeStops, currentStation) => {
    if (expressParts.length === 0) return 'Stops All Stations'
    if (expressParts.length === 1 && expressParts[0].length === 1) return 'All Except ' + expressParts[0][0]
    let texts = []

    let lastStop = null

    expressParts.forEach((expressSection, i) => {
      let firstExpressStop = expressSection[0]
      let lastExpressStop = expressSection.slice(-1)[0]

      let previousStop = routeStops[routeStops.indexOf(firstExpressStop) - 1]
      let nextStop = routeStops[routeStops.indexOf(lastExpressStop) + 1]
      if (lastStop) {
        if (lastStop === previousStop) {
          texts.push(`${previousStop} to ${nextStop}`)
        } else {
          texts.push(`Stops All Stations from ${lastStop} to ${previousStop}`)
          texts.push(`Runs Express from ${previousStop} to ${nextStop}`)
        }
      } else {
        if (currentStation === previousStop) {
          texts.push(`Runs Express to ${nextStop}`)
        } else {
          texts.push(`Stops All Stations to ${previousStop}`)
          texts.push(`Runs Express from ${previousStop} to ${nextStop}`)
        }
      }

      lastStop = nextStop
    })

    texts.push('then Stops All Stations to ' + destination)

    return texts.join(', ').replace(/ Railway Station/g, '')
  },
  filterPlatforms: (departures, platform) => {
    let shouldFilterPlatform = platform !== '*'

    return departures.filter(departure => {
      if (departure.type === 'vline') {
        let mainPlatform = departure.platform.replace(/[A-Z]/, '')
        return !(shouldFilterPlatform && mainPlatform !== platform)
      } else {
        return !(shouldFilterPlatform && departure.platform !== platform)
      }
    })
  }
}
