import getLineStops from '../../../additional-data/route-stops.mjs'
import getMetroDepartures from '../../../modules/metro-trains/get-departures.mjs'
import getVLineDepartures from '../../../modules/vline-old/get-departures.js'
import destinationOverrides from '../../../additional-data/coach-stops.mjs'
import utils from '../../../utils.mjs'
import async from 'async'
import { getDayOfWeek } from '../../../public-holidays.mjs'

const emptyShunts = [] // Replace with metro shunts db

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

let northernGroup = [
  'Craigieburn',
  'Sunbury',
  'Upfield',
  'Werribee',
  'Williamstown',
  'Showgrounds/Flemington',
  'Flemington Racecourse',
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

let caulfieldGroup = [
  'Cranbourne',
  'Pakenham',
  'Frankston',
  'Sandringham'
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']


  export const getHumanName = (fullStopName, stopSuburb) => {
    return destinationOverrides.stops[`${fullStopName.replace('Shopping Centre', 'SC')} ${stopSuburb}`] || fullStopName.replace(/Railway Station.*/, '')
  }
  export const getEmptyShunts = async (station, db) => {
    return await utils.getData('pid-arrivals', station.stopName, async () => {
      let timetables = db.getCollection('timetables')
      let today = await getDayOfWeek(utils.now())
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
        let scheduledDepartureTime = utils.getMomentFromMinutesPastMidnight(arrivalStop.arrivalTimeMinutes, utils.now())

        // to get realtime: check if arriving less that 20min, then request runID + 948000

        let actualDepartureTime = scheduledDepartureTime // use realtime
        let upService = !(arrival.runID[3] % 2)

        return module.exports.addTimeToDeparture({
          trip: arrival,
          type: 'arrival',
          scheduledDepartureTime,
          destination: 'Arrival',
          estimatedDepartureTime: null,
          actualDepartureTime,
          platform: arrivalStop.platform, // use realtime
          cancelled: false, // use realtime
          runID: arrival.runID,
          stoppingPattern: 'Not Taking Passengers',
          stoppingType: 'Not Taking Passengers',
          cleanRouteName: utils.encodeName(arrival.routeName),
          additionalInfo: {
            screenStops: [],
            expressCount: 0,
            viaCityLoop: false,
            direction: upService ? 'Up' : 'Down',
            via: '',
            notTakingPassengers: true
          }
        })
      })
    }, 1000 * 15)
  }
  export const getCombinedDepartures = async (station, db) => {
    return await utils.getData('pid-combined-departures', station.stopName, async () => {
      let timetables = db.getCollection('timetables')

      let vlineDepartures = [], metroDepartures = []

      await Promise.all([
        new Promise(async resolve => {
          try {
            let vlinePlatform = station.bays.find(bay => bay.mode === 'regional train') // Not filtering XPT here as we just want to check if it exists
            if (vlinePlatform) {
              vlineDepartures = (await getVLineDepartures(station, db)).map(departure => {
                departure.type = 'vline'
                departure.actualDepartureTime = departure.estimatedDepartureTime || departure.scheduledDepartureTime

                departure.stopTimings = departure.trip.stopTimings
                let tripStops = departure.stopTimings.map(e => e.stopName)
                let currentIndex = tripStops.indexOf(station.stopName)

                departure.connections = (departure.trip.connections || []).filter(connection => {
                  if (!tripStops.some(s => s === connection.changeAt)) return false
                  let {changeAt} = connection

                  let changeIndex = tripStops.indexOf(changeAt)

                  return changeIndex > currentIndex
                }).map(connection => ({
                  changeAt: connection.changeAt,
                  for: module.exports.getHumanName(connection.for, connection.forSuburb)
                }))

                return departure
              })
            }
          } catch (e) {
            global.loggers.mockups.err('Failed getting departures', e)
          }
          resolve()
        }),
        new Promise(async resolve => {
          try {
            let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
            if (metroPlatform) {
              metroDepartures = (await getMetroDepartures(station, db))
              metroDepartures = await async.map(metroDepartures, async departure => {
                let {runID} = departure
                let today = await getDayOfWeek(utils.now()) // TODO: Change to trip start time

                let scheduled = await timetables.findDocument({
                  runID, operationDays: today
                })

                let stopTimings = departure.trip.stopTimings.slice(0)
                let tripStops = stopTimings.map(e => e.stopName)
                departure.stopTimings = stopTimings

                departure.type = 'metro'
                let currentIndex = tripStops.indexOf(station.stopName)

                if (scheduled) {
                  departure.connections = scheduled.connections.filter(connection => {
                    if (!tripStops.some(s => s === connection.changeAt)) return false
                    let {changeAt} = connection

                    let changeIndex = tripStops.indexOf(changeAt)

                    return changeIndex > currentIndex
                  })
                } else departure.connections = []

                return departure
              })
            }
          } catch (e) {}
          resolve()
        })
      ])

      return [...metroDepartures, ...vlineDepartures].filter(departure => {
        let diff = departure.actualDepartureTime
        let minutesDifference = diff.diff(utils.now(), 'minutes')
        let secondsDifference = diff.diff(utils.now(), 'seconds')

        return !departure.cancelled && minutesDifference < 120 && secondsDifference > -60
      })
    }, 1000 * 15)
  }
  export const addTimeToDeparture = departure => {
    let timeDifference = departure.actualDepartureTime.clone().add(30, 'seconds').diff(utils.now(), 'minutes')
    departure.minutesToDeparture = timeDifference

    if (+timeDifference <= 0) departure.prettyTimeToDeparture = 'NOW'
    else departure.prettyTimeToDeparture = timeDifference + ' min'

    return departure
  }
  export const getFixedLineStops = (tripStops, lineStops, lineName, isUp, type, willSkipCCL) => {
    let viaCityLoop = tripStops.includes('Flagstaff') || tripStops.includes('Parliament') || !!willSkipCCL
    if (!northernGroup.includes(lineName) && !viaCityLoop && type !== 'vline') {
      viaCityLoop = tripStops.includes('Southern Cross')
    }

    let destination = tripStops.slice(-1)[0]

    lineStops = lineStops.filter(e => !cityLoopStations.includes(e) && e !== 'Flinders Street')

    if (viaCityLoop) {
      let cityLoopStops = tripStops.filter(e => cityLoopStations.includes(e) || e === 'Flinders Street')

      if (willSkipCCL) {
        if (northernGroup.includes(lineName)) {
          if (isUp) {
            cityLoopStops = ['Flagstaff', 'Melbourne Central', 'Parliament', 'Flinders Street']
          } else {
            cityLoopStops = ['Flinders Street', 'Parliament', 'Melbourne Central', 'Flagstaff']
          }
        } else {
          if (isUp) {
            cityLoopStops = ['Parliament', 'Melbourne Central', 'Flagstaff', 'Southern Cross', 'Flinders Street']
          } else {
            cityLoopStops = ['Flinders Street', 'Southern Cross', 'Flagstaff', 'Melbourne Central', 'Parliament']
          }
        }
      }

      if (isUp) {
        lineStops = lineStops.concat(cityLoopStops)
      } else {
        lineStops = [...cityLoopStops, ...lineStops]
      }
      if (lineName === 'City Circle') {
        return lineStops
      }
    } else if (type === 'vline') {
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
      if (northernGroup.includes(lineName)) {
        if (isUp) {
          if (destination === 'Flinders Street') {
            lineStops = [...lineStops, 'Southern Cross', 'Flinders Street']
          } else {
            lineStops = [...lineStops, 'Southern Cross']
          }
        } else {
          lineStops = ['Flinders Street', 'Southern Cross', ...lineStops]
        }
      } else {
        if (isUp) {
          lineStops = [...lineStops, 'Flinders Street', 'Southern Cross']
        } else {
          lineStops = ['Southern Cross', 'Flinders Street', ...lineStops]
        }
      }
    }

    if (lineName === 'Werribee') {
      if (tripStops.includes('Altona')) {
        let mainLine = ['Paisley', 'Galvin']
        lineStops = lineStops.filter(e => !mainLine.includes(e))
      } else {
        let altonaLoop = ['Seaholme', 'Altona', 'Westona']
        lineStops = lineStops.filter(e => !altonaLoop.includes(e))
      }
    }

    return lineStops.filter((e, i, a) => a.indexOf(e) === i)
  }
  export const trimTrip = (isUp, stopTimings, fromStation, routeName, willSkipCCL, destination) => {
    if (routeName === 'City Circle') return stopTimings
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

    if (willSkipCCL && stopTimings.includes('Flinders Street')) {
      stopTimings = stopTimings.filter(e => !cityLoopStations.includes(e))
      if (northernGroup.includes(routeName)) {
        if (isUp) {
          if (destination === 'Flinders Street') {
            stopTimings = [...stopTimings.slice(0, -1), 'Southern Cross', 'Flinders Street']
          } else {
            stopTimings = [...stopTimings.slice(0, -1), 'Southern Cross']
          }
        } else {
          stopTimings = ['Flinders Street', 'Southern Cross', ...stopTimings.slice(1)]
        }
      } else {
        if (isUp) {
          stopTimings = [...stopTimings.slice(0, -1), 'Flinders Street']
        } else {
          stopTimings = ['Flinders Street', ...stopTimings.slice(1)]
        }
      }
    }

    return stopTimings
  }
  export const appendScreenDataToDeparture = (departure, destination, station, routeName) => {
    departure = module.exports.addTimeToDeparture(departure)
    departure.cleanRouteName = utils.encodeName(departure.trip.routeName)

    let trip = departure.trip

    let isUp = trip.direction === 'Up'

    let lineStops = departure.lineStops
    let tripStops = departure.tripStops

    let stationName = station.stopName.slice(0, -16)
    let startingIndex = tripStops.indexOf(stationName)

    startingIndex = lineStops.indexOf(stationName)
    let endingIndex = lineStops.lastIndexOf(destination)

    if (trip.routeGTFSID === '2-CCL') endingIndex-- // bring it back from fss to parliament or southern cross

    let tripPassesBy = lineStops.slice(startingIndex, endingIndex + 1)

    let viaCityLoop = tripPassesBy.includes('Flagstaff') || tripPassesBy.includes('Parliament')
    if (!northernGroup.includes(routeName) && !viaCityLoop && departure.type !== 'vline')
     viaCityLoop = tripPassesBy.includes('Southern Cross')

   viaCityLoop = viaCityLoop && !departure.willSkipCCL

    let screenStops = tripPassesBy.map(stop => {
      return {
        stopName: stop,
        isExpress: !tripStops.includes(stop)
      }
    })

    if (!screenStops.length) {
      global.loggers.mockups.err('Failed to find screen stops', tripStops, lineStops, stationName, startingIndex, endingIndex, departure)
      return null
    }
    let expressCount = screenStops.filter(stop => stop.isExpress).length

    let isCityStop = cityLoopStations.includes(stationName)
    let isFSS = stationName === 'Flinders Street'
    let toCity = isUp && (tripStops.includes('Flinders Street') || tripStops.includes('Southern Cross'))

    let via = ''

    let isUpService = trip.direction === 'Up'

    function fromRoute() {
      if (northernGroup.includes(routeName)) via = 'via Sthn Cross'
      // else if (cliftonHillGroup.includes(routeName)) via = 'via Jolimont'
      else if (cliftonHillGroup.includes(routeName)) via = '' // Apparently there's no via JLI
      else via = 'via Richmond'
    }

    if (departure.type !== 'vline') {
      if ((toCity || isFSS) && !isCityStop) {
        if (viaCityLoop && isFSS) via = 'via City Loop'
        else if (!(northernGroup.includes(routeName) && toCity)) fromRoute()
      } else if (isCityStop && destination !== 'Flinders Street') {
        if (viaCityLoop) via = 'via City Loop'
        else if (tripPassesBy.includes('Flinders Street')) {
          via = 'via Flinders St'
        } else fromRoute()
      }
    }

    let stopData = trip.stopTimings.find(stop => stop.stopName === station.stopName)

    let notTakingPassengers = false
    if (stopData.stopConditions) // trips matching using wtt timetables and live timetables don't have NTP
      notTakingPassengers = stopData.stopConditions.pickup === 1

    departure.additionalInfo = {
      screenStops, expressCount, viaCityLoop, direction: isUp ? 'Up': 'Down', via, notTakingPassengers
    }
    if (trip.routeGTFSID === '2-CCL') departure.destination = 'City Loop'

    return departure
  }
  export const findExpressStops = (tripStops, lineStops, routeName, isUp, stationName) => {
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
  }
  export const determineStoppingPattern = (expressParts, destination, lineStops, currentStation, stoppingText) => {
    if (expressParts.length === 0) return stoppingText.stopsAll
    if (expressParts.length === 1 && expressParts[0].length === 1) return stoppingText.allExcept.format(expressParts[0][0])

    let texts = []

    let lastStop = null

    expressParts.forEach((expressSection, i) => {
      let firstExpressStop = expressSection[0]
      let lastExpressStop = expressSection.slice(-1)[0]

      let previousStopIndex = lineStops.indexOf(firstExpressStop) - 1
      let nextStopIndex = lineStops.indexOf(lastExpressStop) + 1

      let previousStop = lineStops[previousStopIndex]
      let nextStop = lineStops[nextStopIndex]

      if (lastStop) {
        let lastStopIndex = lineStops.indexOf(lastStop)

        if (i === expressParts.length - 1 && nextStop === destination) {
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
          if (nextStopIndex - lineStops.indexOf(currentStation) === 1) {
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

    if (lineStops[lineStops.indexOf(lastStop)] !== destination) {
      texts.push(stoppingText.thenSASTo.format(destination))
    }

    return texts.join(', ').replace(/ Railway Station/g, '')
  }
  export const filterPlatforms = (departures, platform) => {
    let shouldFilterPlatform = platform !== '*'
    if (!shouldFilterPlatform) return departures

    return departures.filter(departure => {
      let departurePlatform = departure.platform.replace('?', '')
      if (!departurePlatform) return null
      departurePlatform = departurePlatform.toString()
      if (departure.type === 'vline') {
        let mainPlatform = departurePlatform.replace(/[A-Z]/, '')
        return mainPlatform === platform
      } else {
        return departurePlatform === platform
      }
    })
  }
  export const trimDepartureData = (departures, maxDepartures, addStopTimings, fromStop) => {
    return departures.map((departure, i) => {
      let data = {
        destination: departure.destination,
        scheduledDepartureTime: departure.scheduledDepartureTime,
        estimatedDepartureTime: departure.estimatedDepartureTime,
        actualDepartureTime: departure.actualDepartureTime,
        platform: departure.platform,
        type: departure.type,
        connections: departure.connections,
        stoppingPattern: departure.stoppingPattern,
        stoppingType: departure.stoppingType,
        minutesToDeparture: departure.minutesToDeparture,
        prettyTimeToDeparture: departure.prettyTimeToDeparture,
        routeName: departure.trip.routeName,
        cleanRouteName: departure.cleanRouteName,
        additionalInfo: departure.additionalInfo,
        direction: departure.trip.direction
      }

      if (i > 1) data.additionalInfo.screenStops = []

      let hasSeenStop = false

      if (!departure.stopTimings) departure.stopTimings = []
      if (addStopTimings) data.stopTimings = departure.stopTimings.filter(stop => {
        if (hasSeenStop) return true
        if (stop.stopName === fromStop) {
          hasSeenStop = true
          return true
        }
        return false
      }).map(stop => ({
        stopName: stop.stopName.slice(0, -16),
        arrivalTimeMinutes: stop.arrivalTimeMinutes,
        departureTimeMinutes: stop.departureTimeMinutes
      }))
      return data
    }).slice(0, maxDepartures)
  },
  export const getPIDSDepartures = async (db, station, platform, stoppingText, stoppingType, maxDepartures=6, addStopTimings=false) => {
    stoppingText = stoppingText || defaultStoppingText
    stoppingType = stoppingType || defaultStoppingType

    let stationName = station.stopName.slice(0, -16)
    let cacheKey = `${stationName}${platform}${maxDepartures}`

    return await utils.getData('pid-departures', cacheKey, async () => {
      let allDepartures = await module.exports.getCombinedDepartures(station, db)
      let hasRRB = !!allDepartures.find(d => d.isRailReplacementBus)
      allDepartures = allDepartures.filter(d => !d.isRailReplacementBus)
      let platformDepartures = module.exports.filterPlatforms(allDepartures, platform)

      let arrivals = await module.exports.getEmptyShunts(station, db)
      let platformArrivals = module.exports.filterPlatforms(arrivals, platform)

      let mappedDepartures = platformDepartures.map(departure => {
        let {trip, destination} = departure
        let {routeGTFSID, direction} = trip
        let isUp = direction === 'Up'
        let routeName = departure.shortRouteName || trip.routeName

        let tripStops = trip.stopTimings.filter(stop => !stop.cancelled && (stop.stopConditions ? stop.stopConditions.dropoff === 0 : true) || stop.stopName === station.stopName).map(stop => stop.stopName.slice(0, -16))

        if (routeName === 'Bendigo') {
          if (isUp && departure.trip.origin === 'Eaglehawk Railway Station') routeName = 'Swan Hill'
          if (!isUp && departure.trip.destination === 'Eaglehawk Railway Station') routeName = 'Swan Hill'
        }

        let lineStops = getLineStops(routeName)
        if (!lineStops) global.loggers.mockups.err('No route data', routeName)
        if (destination === 'City Loop') destination = 'Flinders Street'

        if (isUp) lineStops = lineStops.slice(0).reverse()

        tripStops = module.exports.trimTrip(isUp, tripStops, stationName, routeName, departure.willSkipCCL, destination)
        lineStops = module.exports.getFixedLineStops(tripStops, lineStops, routeName, isUp, departure.type, departure.willSkipCCL)

        departure.lineStops = lineStops
        departure.tripStops = tripStops

        let expresses = module.exports.findExpressStops(tripStops, lineStops, routeName, isUp, stationName)
        let stoppingPattern = module.exports.determineStoppingPattern(expresses, destination, lineStops, stationName, stoppingText)

        departure.stoppingPattern = stoppingPattern

        let expressCount = expresses.reduce((a, e) => a + e.length, 0)

        if (departure.type === 'vline' && stoppingType.vlineService) {
          departure.stoppingType = stoppingType.vlineService.stoppingType
          if (stoppingType.vlineService.stoppingPatternPostfix) {
            departure.stoppingPattern += stoppingType.vlineService.stoppingPatternPostfix
          }
        } else if (expressCount === 0) departure.stoppingType = stoppingType.sas
        else if (expressCount < 4) departure.stoppingType = stoppingType.limExp
        else departure.stoppingType = stoppingType.exp

        departure = module.exports.appendScreenDataToDeparture(departure, destination, station, routeName)

        return departure
      }).concat(platformArrivals).sort((a, b) => {
        return a.actualDepartureTime - b.actualDepartureTime
          || a.destination.localeCompare(b.destination)
      })

      let hasDepartures = allDepartures.length > 0

      return {
        stationName,
        departures: module.exports.trimDepartureData(mappedDepartures, maxDepartures, addStopTimings, station.stopName),
        hasDepartures,
        hasRRB
      }
    }, 1000 * 15)
  }
