const getLineStops = require('./route-stops')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getVLineDepartures = require('../../../modules/vline/get-departures')
const utils = require('../../../utils')
const async = require('async')
const emptyShunts = require('../../../additional-data/empty-shunts.json')

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

let cliftonHillGroup = [
  'Hurstbridge',
  'Mernda'
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']


module.exports = {
  getEmptyShunts: async (station, db) => {
    let timetables = db.getCollection('timetables')
    let today = utils.getPTDayName(utils.now())
    let minutesPastMidnight = utils.getPTMinutesPastMidnight(utils.now())

    let emptyShuntsToday = emptyShunts.filter(emptyShunt => emptyShunt.operationDays === today)
    let runIDs = emptyShuntsToday.map(emptyShunt => emptyShunt.runID)

    let arrivals = await timetables.findDocuments({
      destination: station.stopName,
      operationDays: today,
      stopTimings: {
        $elemMatch: {
          stopName: station.stopName,
          arrivalTimeMinutes: {
            $gte: minutesPastMidnight,
            $lte: minutesPastMidnight + 120,
          }
        }
      },
      runID: {
        $in: runIDs
      }
    }).sort({ destinationArrivalTime: 1 }).limit(20).toArray()

    return await async.map(arrivals, async arrival => {
      let arrivalStop = arrival.stopTimings.slice(-1)[0]
      let scheduledDepartureTime = utils.minutesAftMidnightToMoment(arrivalStop.arrivalTimeMinutes, utils.now())

      // to get realtime: check if arriving less that 20min, then request runID + 948000

      let actualDepartureTime = scheduledDepartureTime // use realtime

      return module.exports.addTimeToDeparture({
        trip: arrival,
        type: 'arrival',
        scheduledDepartureTime,
        estimatedDepartureTime: null,
        actualDepartureTime,
        platform: arrivalStop.platform, // use realtime
        cancelled: false, // use realtime
        runID: arrival.runID,
        stoppingPattern: 'Not Taking Passengers',
        stoppingType: 'Not Taking Passengers',
        codedLineName: utils.encodeName(arrival.routeName),
        additionalInfo: {
          screenStops: [],
          expressCount: [],
          viaCityLoop: false,
          direction: 'Down',
          via: '',
          notTakingPassengers: true
        }
      })
    })
  },
  getCombinedDepartures: async (station, db) => {
    let timetables = db.getCollection('timetables')

    let vlineDepartures = [], metroDepartures = []

    try {
      let vlinePlatform = station.bays.find(bay => bay.mode === 'regional train')
      if (vlinePlatform) {
        vlineDepartures = (await getVLineDepartures(station, db)).map(departure => {
          if (departure.platform)
            departure.platform = departure.platform
          departure.type = 'vline'
          departure.actualDepartureTime = departure.scheduledDepartureTime

          return departure
        })
      }
    } catch (e) {}

    try {
      let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
      if (metroPlatform) {
        metroDepartures = (await getMetroDepartures(station, db))
        metroDepartures = await async.map(metroDepartures, async departure => {
          let {runID} = departure
          let today = utils.getPTDayName(utils.now())

          let scheduled = await timetables.findDocument({
            runID, operationDays: today
          })

          if (scheduled) {
            departure.connections = scheduled.connections.filter(connection => {
              return !!departure.trip.stopTimings.find(s => s.stopName === connection.changeAt)
            })
          } else departure.connections = []

          return departure
        })
      }
    } catch (e) {}

    let departures = [...metroDepartures, ...vlineDepartures].filter(departure => {
      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')

      return !departure.cancelled && minutesDifference < 120 && secondsDifference > -60
    })

    return departures.sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  },
  addTimeToDeparture: departure => {
    let timeDifference = departure.actualDepartureTime.clone().add(30, 'seconds').diff(utils.now(), 'minutes')
    departure.minutesToDeparture = timeDifference

    if (+timeDifference <= 0) departure.prettyTimeToDeparture = 'NOW'
    else {
      departure.prettyTimeToDeparture = timeDifference + ' min'
    }
    return departure
  },
  getFixedLineStops: (tripStops, lineStops, lineName, isUp, type) => {
    let viaCityLoop = tripStops.includes('Flagstaff') || tripStops.includes('Parliament')
    if (!northernGroup.includes(lineName) && !viaCityLoop && type !== 'vline')
     viaCityLoop = tripStops.includes('Southern Cross')

    let destination = tripStops.slice(-1)[0]

    if (viaCityLoop) {
      let cityLoopStops = tripStops.filter(e => cityLoopStations.includes(e) || e === 'Flinders Street')
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e) && e !== 'Flinders Street')

      if (isUp) {
        lineStops = lineStops.concat(cityLoopStops)
      } else {
        lineStops = [...cityLoopStops, ...lineStops]
      }
      if (lineName === 'City Loop') {
        return lineStops
      }
    } else if (type === 'vline') {
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e) && e !== 'Flinders Street')
      if (isUp) {
        if (gippslandLines.includes(lineName))
          lineStops = [...lineStops, 'Flinders Street', 'Southern Cross']
        else
          lineStops = [...lineStops, 'Southern Cross']
      } else {
        if (gippslandLines.includes(lineName))
          lineStops = ['Southern Cross', 'Flinders Street', ...lineStops]
        else
          lineStops = ['Southern Cross', ...lineStops]
      }
    } else {
      lineStops = lineStops.filter(e => !cityLoopStations.includes(e))
      if (northernGroup.includes(lineName)) {
        if (isUp) {
          if (destination === 'Flinders Street') {
            lineStops = [...lineStops.slice(0, -1), 'Southern Cross', 'Flinders Street']
          } else {
            lineStops = [...lineStops.slice(0, -1), 'Southern Cross']
          }
        } else {
          lineStops = ['Flinders Street', 'Southern Cross', ...lineStops.slice(1)]
        }
      } else if (lineName === 'Frankston') {
        if (isUp) {
          lineStops = [...lineStops.slice(0, -1), 'Flinders Street', 'Southern Cross']
        } else {
          lineStops = ['Southern Cross', 'Flinders Street', ...lineStops.slice(1)]
        }
      }
    }

    return lineStops.filter((e, i, a) => a.indexOf(e) === i)
  },
  trimTrip: (isUp, stopTimings, fromStation, routeName) => {
    if (routeName === 'City Loop') return stopTimings
    if (isUp) {
      let hasSeenFSS = false
      let destStop = 'Flinders Street'
      if (gippslandLines.includes(routeName)) {
        destStop = 'Southern Cross'
      }
      stopTimings = stopTimings.filter(e => {
        if (hasSeenFSS) return false
        if (e === destStop) {
          hasSeenFSS = true
        }
        return true
      })
    } else {
      let fssIndex = stopTimings.indexOf('Flinders Street')
      if (fssIndex === -1) fssIndex = Infinity
      let stationIndex = stopTimings.indexOf(fromStation)
      let startIndex = Math.min(fssIndex, stationIndex)
      stopTimings = stopTimings.slice(startIndex)
    }

    return stopTimings
  },
  appendScreenDataToDeparture: (departure, station) => {
    departure = module.exports.addTimeToDeparture(departure)
    departure.codedLineName = utils.encodeName(departure.trip.routeName)

    let relevantTrip = departure.forming || departure.trip
    let routeName = departure.shortRouteName || relevantTrip.routeName

    // If there's a forming then consider it as a down trip
    let isFormingNewTrip = !!departure.forming
    let isUp = departure.trip.direction === 'Up' && !isFormingNewTrip
    let destination = isFormingNewTrip ? departure.destination : departure.trip.destination.slice(0, -16)
    if (destination === 'Parliament' || (routeName === 'Frankston' && destination === 'Southern Cross')) destination = 'Flinders Street'

    if (routeName === 'Bendigo') {
      if (isUp && departure.trip.origin === 'Eaglehawk Railway Station') routeName = 'Swan Hill'
      if (!isUp && departure.trip.destination === 'Eaglehawk Railway Station') routeName = 'Swan Hill'
    }

    let lineStops = getLineStops(routeName)
    let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

    if (departure.forming) {
      let prevTripCityLoop = tripStops.filter(e => cityLoopStations.includes(e))
      tripStops = [...prevTripCityLoop, ...departure.forming.stopTimings.map(stop => stop.stopName.slice(0, -16))]
      tripStops = tripStops.filter((e, i, a) => a.indexOf(e) === i)

      lineStops = getLineStops(departure.forming.routeName, departure.destination)
    }

    lineStops = lineStops.slice(0)

    let stationName = station.stopName.slice(0, -16)
    if (isUp) {
      lineStops = lineStops.reverse()
    }

    tripStops = module.exports.trimTrip(isUp, tripStops, stationName, routeName)

    let startingIndex = tripStops.indexOf(stationName)
    tripStops = tripStops.slice(startingIndex)

    lineStops = module.exports.getFixedLineStops(tripStops, lineStops, routeName, isUp, departure.type)

    startingIndex = lineStops.indexOf(stationName)
    let endingIndex = lineStops.lastIndexOf(destination)
    if (departure.trip.routeGTFSID === '2-CCL') endingIndex-- // bring it back from fss to parliament or southern cross

    let tripPassesBy = lineStops.slice(startingIndex, endingIndex + 1)

    let viaCityLoop = tripStops.includes('Flagstaff') || tripStops.includes('Parliament')
    if (!northernGroup.includes(routeName) && !viaCityLoop && departure.type !== 'vline')
     viaCityLoop = tripStops.includes('Southern Cross')

    let screenStops = tripPassesBy.map(stop => {
      return {
        stopName: stop,
        isExpress: !tripStops.includes(stop)
      }
    })

    if (!screenStops.length) return null
    let expressCount = screenStops.filter(stop => stop.isExpress).length

    let isCityStop = cityLoopStations.includes(stationName) || stationName === 'Flinders Street'

    let via = ''

    let isUpService = relevantTrip.direction === 'Up'

    if (departure.type !== 'vline') {
      if (isCityStop || isUp) {
        if (viaCityLoop && !isUpService) via = 'via City Loop'
        else {
          if (northernGroup.includes(routeName)) via = 'via Sthn Cross'
          else if (cliftonHillGroup.includes(routeName)) via = 'via Jolimont'
          else via = 'via Richmond'
        }
      }
    }

    let stopData = departure.trip.stopTimings.find(stop => stop.stopName === station.stopName)

    let notTakingPassengers = false
    if (stopData.stopConditions) // trips matching using wtt timetables and live timetables don't have NTP
      notTakingPassengers = stopData.stopConditions.pickup === 1

    let additionalInfo = {
      screenStops, expressCount, viaCityLoop, direction: isUp ? 'Up': 'Down', via, notTakingPassengers
    }

    departure.additionalInfo = additionalInfo
    if (departure.trip.routeGTFSID === '2-CCL') departure.destination = 'City Loop'

    return departure
  },
  findExpressStops: (tripStops, lineStops, routeName, isUp, stationName) => {
    tripStops = module.exports.trimTrip(isUp, tripStops, stationName, routeName)

    let startIndex = tripStops.indexOf(stationName)
    let endIndex = tripStops.length

    if (isUp) {
      let fssIndex = tripStops.indexOf('Flinders Street')
      if (fssIndex !== -1)
        endIndex = fssIndex
    }

    tripStops = tripStops.slice(startIndex, endIndex + 1)

    let firstStop = tripStops[0]
    let lastStop = tripStops.slice(-1)[0]

    let firstStopIndex = lineStops.indexOf(firstStop)
    let lastStopIndex = lineStops.indexOf(lastStop) + 1
    let relevantStops = lineStops.slice(firstStopIndex, lastStopIndex)

    let expressParts = []

    let lastMainMatch = 0
    let expressStops = 0

    for (let scheduledStop of tripStops) {
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
  determineStoppingPattern: (expressParts, destination, lineStops, currentStation, textMap=defaultStoppingMap) => {
    if (expressParts.length === 0) return textMap.stopsAll
    if (expressParts.length === 1 && expressParts[0].length === 1) return textMap.allExcept.format(expressParts[0][0])

    let texts = []

    let lastStop = null

    expressParts.forEach((expressSection, i) => {
      let firstExpressStop = expressSection[0]
      let lastExpressStop = expressSection.slice(-1)[0]

      let previousStop = lineStops[lineStops.indexOf(firstExpressStop) - 1]
      let nextStop = lineStops[lineStops.indexOf(lastExpressStop) + 1]

      if (lastStop) {
        if (i === expressParts.length - 1 && nextStop === destination) {
          texts.push(textMap.thenRunsExpressAtoB.format(previousStop, nextStop))
        } else if (lastStop === previousStop) {
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

    if (lineStops[lineStops.indexOf(lastStop)] !== destination) {
      texts.push(textMap.thenSASTo.format(destination))
    }

    return texts.join(', ').replace(/ Railway Station/g, '')
  },
  filterPlatforms: (departures, platform) => {
    let shouldFilterPlatform = platform !== '*'
    if (!shouldFilterPlatform) return departures

    return departures.filter(departure => {
      let departurePlatform = departure.platform
      if (!departurePlatform) return null
      departurePlatform = departurePlatform.toString()
      if (departure.type === 'vline') {
        let mainPlatform = departurePlatform.replace(/[A-Z]/, '')
        return mainPlatform === platform
      } else {
        return departurePlatform === platform
      }
    })
  },
  getPIDSDepartures: async (db, station, platform, stoppingTextMap, stoppingTypeMap) => {
    let stationName = station.stopName.slice(0, -16)

    let allDepartures = await module.exports.getCombinedDepartures(station, db)
    let hasRRB = !!allDepartures.find(d => d.isTrainReplacement)
    allDepartures = allDepartures.filter(d => !d.isTrainReplacement)
    let platformDepartures = module.exports.filterPlatforms(allDepartures, platform)

    let arrivals = await module.exports.getEmptyShunts(station, db)
    let platformArrivals = module.exports.filterPlatforms(arrivals, platform)

    platformDepartures = platformDepartures.map(departure => {
      let {trip, destination} = departure
      let {routeGTFSID, direction, stopTimings} = trip
      let isUp = direction === 'Up' && !departure.forming
      let routeName = departure.shortRouteName || trip.routeName

      let tripStops = stopTimings.map(stop => stop.stopName.slice(0, -16))
      if (departure.forming) {
        tripStops = tripStops.concat(departure.forming.stopTimings.map(stop => stop.stopName.slice(0, -16)))
          .filter((e, i, a) => a.indexOf(e) == i)
      }

      if (routeName === 'Bendigo') {
        if (isUp && departure.trip.origin === 'Eaglehawk Railway Station') routeName = 'Swan Hill'
        if (!isUp && departure.trip.destination === 'Eaglehawk Railway Station') routeName = 'Swan Hill'
      }

      let lineStops = getLineStops(routeName)
      if (destination === 'City Loop') destination = 'Flinders Street'

      if (isUp) lineStops = lineStops.slice(0).reverse()

      lineStops = module.exports.getFixedLineStops(tripStops, lineStops, routeName, isUp, departure.type)
      let expresses = module.exports.findExpressStops(tripStops, lineStops, routeName, isUp, stationName)
      let stoppingPattern = module.exports.determineStoppingPattern(expresses, destination, lineStops, stationName, stoppingTextMap)

      departure.stoppingPattern = stoppingPattern

      let expressCount = expresses.reduce((a, e) => a + e.length, 0)

      if (departure.type === 'vline') {
        departure.stoppingType = stoppingTypeMap.vlineService.stoppingType
        if (stoppingTypeMap.vlineService.stoppingPatternPostfix) {
          departure.stoppingPattern += stoppingTypeMap.vlineService.stoppingPatternPostfix
        }
      } else if (expressCount === 0) departure.stoppingType = stoppingTypeMap.sas
      else if (expressCount < 5) departure.stoppingType = stoppingTypeMap.limExp
      else departure.stoppingType = stoppingTypeMap.exp

      departure = module.exports.appendScreenDataToDeparture(departure, station)

      return departure
    }).concat(platformArrivals).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)

    let hasDepartures = allDepartures.length > 0

    return { departures: platformDepartures, hasDepartures, hasRRB }
  }
}
