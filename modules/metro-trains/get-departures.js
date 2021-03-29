const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const findConsist = require('./fleet-parser')
const departureUtils = require('../utils/get-train-timetables-new')
const fixTripDestination = require('./fix-trip-destinations')
const getStoppingPattern = require('./get-stopping-pattern')
const getRouteStops = require('../../additional-data/route-stops')
const { getDayOfWeek } = require('../../public-holidays')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']
let cityStations = [...cityLoopStations, 'Flinders Street']

let burnleyGroup = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
let caulfieldGroup = ['Frankston', 'Cranbourne', 'Pakenham', 'Sandringham']
let dandenongGroup = ['Cranbourne', 'Pakenham']
let northernGroup = ['Craigieburn', 'Sunbury', 'Upfield', 'Showgrounds/Flemington', 'Werribee', 'Williamstown']
let cliftonHillGroup = ['Mernda', 'Hurstbridge']
let genericGroup = ['City Circle', 'Stony Point']

let lineGroups = [
  burnleyGroup, caulfieldGroup,
  northernGroup, cliftonHillGroup,
  genericGroup
]

function addCityLoopRunning(train, stationName) {
  let { routeName, viaCityLoop, runDestination, runID } = train
  let loopRunning = []

  if (northernGroup.includes(routeName)) {
    if (viaCityLoop) {
      loopRunning = ['FGS', 'MCE', 'PAR', 'FSS', 'SSS']
    } else {
      if (runDestination === 'Southern Cross') {
        loopRunning = ['NME', 'SSS']
      } else if (runDestination === 'Flagstaff') {
        loopRunning = ['SSS', 'FSS', 'PAR', 'MCE', 'FGS']
      } else {
        loopRunning = ['NME', 'SSS', 'FSS']
      }
    }
  } else if (cliftonHillGroup.includes(routeName)) {
    if (viaCityLoop) {
      loopRunning = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
    } else {
      if (runDestination === 'Parliament') {
        loopRunning = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
      } else {
        loopRunning = ['JLI', 'FSS']
      }
    }
  } else if (burnleyGroup.includes(routeName) || caulfieldGroup.includes(routeName)) {
    if (viaCityLoop) {
      loopRunning = ['PAR', 'MCE', 'FGS', 'SSS', 'FSS']
    } else {
      if (runDestination === 'Southern Cross') {
        loopRunning = ['RMD', 'FSS', 'SSS']
      } else if (runDestination === 'Parliament' || cityLoopStations.includes(stationName)) {
        loopRunning = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR']
      } else {
        loopRunning = ['RMD', 'FSS']
      }
    }
  }

  if (routeName === 'City Circle') {
    if (700 <= runID && runID <= 799) loopRunning = ['FSS', 'PAR', 'MCE', 'FGS', 'SSS', 'FSS']
    if (800 <= runID && runID <= 899) loopRunning = ['FSS', 'SSS', 'FGS', 'MCE', 'PAR', 'FSS']
  } else if (train.direction === 'Down') loopRunning.reverse()

  train.cityLoopRunning = loopRunning
}

function addAltonaLoopRunning(train) {
  if (train.viaAltonaLoop !== null) {
    if (train.viaAltonaLoop) { // Via ALT Loop
      loopRunning = ['WTO', 'ALT', 'SHE']
    } else { // Via ML
      loopRunning = ['LAV', 'NPT']
    }

    if (train.direction === 'Down') loopRunning.reverse()
    train.altonaLoopRunning = loopRunning
  }
}

function addStonyPointPlatform(train, stationName) {
  if (stationName === 'Frankston') train.platform = '3'
  else train.platform = '1'
}

function mapSuspension(suspensionText, routeName) {
  let stationsAffected = suspensionText
    .replace(/\u00A0/g, ' ').replace(/[–-]/, ' and ')
    .match(/trains (?:between )?([ \w]+) and ([ \w\/]+) (?:stations|due)/i)

  if (!stationsAffected) return
  let startStation = utils.titleCase(stationsAffected[1].trim())
  let endStations = stationsAffected[2].trim()

  // Station A should always be on the UP end
  let routeStops = getRouteStops(routeName)
  let startIndex = routeStops.indexOf(startStation)
  if (startIndex === -1) return

  let allSuspensions = []

  endStations.split('/').forEach(rawEndStation => {
    let endStation = utils.titleCase(rawEndStation)
    let endIndex = routeStops.indexOf(endStation)
    if (endIndex === -1) return

    if (endIndex < startIndex) {
      let c = startStation
      startStation = endStation
      endStation = c
    }

    allSuspensions.push({
      upStation: startStation + ' Railway Station',
      downStation: endStation + ' Railway Station',
    })
  })

  return allSuspensions
}

function isCityLoop(disruption) {
  return disruption.text.toLowerCase().includes('city loop')
}

function isAltonaLoop(disruption) {
  let text = disruption.text
  return text.includes('Altona') || text.includes('Seaholme') || text.includes('Westona')
    || (text.includes('Newport') && text.includes('Laverton'))
}

async function getNotifyData(db) {
  let metroNotify = db.getCollection('metro notify')

  let disruptions = await metroNotify.findDocuments({
    toDate: {
      $gte: +new Date() / 1000
    },
    active: true
  }).toArray()

  let suspensions = {}
  disruptions.forEach(suspension => {
    if (suspension.type === 'suspended') {
      suspension.routeName.forEach(route => {
        let suspensionData = mapSuspension(suspension.text, route)
        if (suspensionData.length) {
          if (!suspensions[route]) suspensions[route] = []
          suspensions[route].push(...suspensionData)
        }
      })
    }
  })

  if (suspensions.Frankston) {
    let possibleSty = suspensions.Frankston.find(s => s.stationB === 'Stony Point Railway Station')
    if (possibleSty && !suspensions['Stony Point']) suspensions['Stony Point'] = [possibleSty]
  }

  let allTrainAlterations = disruptions.filter(disruption => disruption.runID)
  let stonyPointReplacements = allTrainAlterations.filter(disruption => {
    let text = disruption.text
    return disruption.routeName === 'Stony Point' && text.includes('replace') || text.includes('coach')
  }).map(disruption => disruption.runID)

  let loopSkipping = allTrainAlterations.filter(disruption => {
    let { text } = disruption
    return text.includes('direct')
      || (text.includes('express') && isAltonaLoop(disruption))
  })

  let trainAlterations = allTrainAlterations.filter(disruption => {
    let text = disruption.text
    return (!text.includes('cancel') && !loopSkipping.includes(disruption))
      || text.includes('originate') || text.includes('terminate') || text.includes('express')
  })

  let cityLoopSkipping = loopSkipping.filter(isCityLoop).map(disruption => disruption.runID)
  let altonaLoopSkipping = loopSkipping.filter(isAltonaLoop).map(disruption => disruption.runID)

  let broadLoopSkipping = disruptions.filter(disruption => {
    return disruption.type !== 'works' && !disruption.runID
      && disruption.text.includes('direct')
      && disruption.text.toLowerCase().includes('all trains')
  })

  let broadCityLoopSkipping = broadLoopSkipping.filter(isCityLoop).map(disruption => disruption.routeName).reduce((a, e) => a.concat(e), [])
  let broadAltonaLoopSkipping = broadLoopSkipping.filter(isAltonaLoop).length !== 0

  return {
    suspensions,
    suspendedLines: Object.keys(suspensions),
    stonyPointReplacements,
    trainAlterations,
    cityLoopSkipping,
    altonaLoopSkipping,
    broadCityLoopSkipping,
    broadAltonaLoopSkipping
  }
}

function adjustSuspension(suspension, trip, currentStation) {
  let startStation, endStation

  if (trip.direction === 'Up') {
    startStation = suspension.downStation
    endStation = suspension.upStation
  } else {
    startStation = suspension.upStation
    endStation = suspension.downStation
  }

  let disruptionStatus = ''

  let tripStops = trip.stopTimings.map(stop => stop.stopName)
  let startIndex = tripStops.indexOf(startStation)
  let currentIndex = tripStops.indexOf(currentStation)
  let endIndex = tripStops.indexOf(endStation)

  if (startIndex !== -1 && endIndex === -1) endIndex = tripStops.length - 1
  if (startIndex === -1 && endIndex !== -1) startIndex = 0

  if (currentIndex < startIndex) { // we're approaching disruption
    disruptionStatus = 'before'
  } else if (currentIndex == endIndex) { // we are at end of disruption
    disruptionStatus = 'passed'
  } else if (currentIndex < endIndex) { // we're inside disruption
    disruptionStatus = 'current'
  } else { // already passed
    disruptionStatus = 'passed'
  }

  return {
    startStation, endStation,
    disruptionStatus
  }
}

async function applySuspension(train, notifyData, metroPlatform, db) {
  if (notifyData.suspendedLines.includes(train.routeName)) {
    let rawSuspension = notifyData.suspensions[train.routeName][0]
    let suspension = adjustSuspension(rawSuspension, train.trip, metroPlatform.fullStopName)

    let trip = train.trip
    let tripStops = trip.stopTimings.map(stop => stop.stopName)
    let isDown = train.direction === 'Down'

    train.suspension = suspension
    trip.suspension = suspension

    if (suspension.disruptionStatus === 'before') { // Cut destination
      let startIndex = tripStops.indexOf(suspension.startStation)
      if (startIndex == -1) startIndex = tripStops.length

      trip.stopTimings = trip.stopTimings.slice(0, startIndex + 1)
      trip.runID = train.runID + (isDown ? 'U' : 'D')
    } else if (suspension.disruptionStatus === 'current') { // Rail bus
      let startIndex = tripStops.indexOf(suspension.startStation)
      let endIndex = tripStops.indexOf(suspension.endStation)

      if (startIndex == -1) startIndex = 0
      if (endIndex == -1) endIndex = tripStops.length

      trip.stopTimings = trip.stopTimings.slice(startIndex, endIndex + 1)
      trip.cancelled = false

      train.isRailReplacementBus = true
      train.cancelled = false

      train.estimatedDepartureTime = null
      train.actualDepartureTime = train.scheduledDepartureTime

      trip.runID = train.runID + 'B'
    } else if (suspension.disruptionStatus === 'passed') { // Cut origin
      let endIndex = tripStops.indexOf(suspension.endStation)
      if (endIndex == -1) endIndex = 0

      trip.stopTimings = trip.stopTimings.slice(endIndex)

      trip.runID = train.runID + (isDown ? 'D' : 'U')
    }

    let firstStop = trip.stopTimings[0]
    let lastStop = trip.stopTimings.slice(-1)[0]

    firstStop.arrivalTime = null
    firstStop.arrivalTimeMinutes = null
    lastStop.departureTime = null
    lastStop.departureTimeMinutes = null

    trip.originalDestination = trip.destination

    trip.origin = firstStop.stopName
    trip.destination = lastStop.stopName
    trip.departureTime = firstStop.departureTime
    trip.destinationArrivalTime = lastStop.arrivalTime

    fixTripDestination(trip)

    train.destination = trip.trueDestination.slice(0, -16)
  } else if (train.routeName === 'Stony Point' && notifyData.stonyPointReplacements.includes(train.runID)) {
    train.isRailReplacementBus = true
    train.trip.runID = train.runID + 'B'
  } else {
    train.suspension = null
    train.trip.suspension = null
  }

  return train
}

function filterDepartures(departures, filter) {
  let filteredDepartures = departures
  if (filter) {
    let now = utils.now()

    filteredDepartures = departures.filter(departure => {
      let secondsDiff = departure.actualDepartureTime.diff(now, 'seconds')

      return -30 < secondsDiff && secondsDiff < 5400 // 1.5 hours
    })
  }

  return filteredDepartures.sort((a, b) => {
    let aLastStop = a.trip.stopTimings[a.trip.stopTimings.length - 1]
    let bLastStop = b.trip.stopTimings[b.trip.stopTimings.length - 1]

    return a.actualDepartureTime - b.actualDepartureTime
      || a.destination.localeCompare(b.destination)
      || aLastStop.arrivalTimeMinutes - bLastStop.arrivalTimeMinutes
  })
}

async function matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations) {
  let fullPossibleDestinations = possibleDestinations.map(dest => dest + ' Railway Station')

  let data = {
    stopGTFSID,
    possibleLines,
    departureTime: train.scheduledDepartureTime,
    possibleDestinations: fullPossibleDestinations,
    direction: train.direction,
    viaCityLoop: train.viaCityLoop
  }

  return await departureUtils.getLiveDeparture(data, db)
    || await departureUtils.getScheduledDeparture(data, db)
}

async function genericMatch(train, stopGTFSID, stationName, db) {
  let possibleLines = lineGroups.find(group => group.includes(train.routeName)) || train.routeName

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Parliament') // RMD/JLI -> FSS -> CLP -> PAR
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flinders Street' && !train.viaCityLoop)
    possibleDestinations.push('Parliament')

  let trip = await matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations)
  return trip
}

async function cfdGroupMatch(train, stopGTFSID, stationName, db) {
  let possibleLines = caulfieldGroup

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Parliament') // RMD -> FSS -> CLP -> PAR
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Southern Cross' && !train.viaCityLoop) // RMD -> FSS -> SSS -> NPT (Occo Only)
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flagstaff' && train.viaCityLoop) // RMD -> CLP -> FSS -> PAR -> CLP -> FGS -> NME
    possibleDestinations.push('Flinders Street')

  let trip = await matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations)
  return trip
}

async function norGroupMatch(train, stopGTFSID, stationName, db) {
  let possibleLines = northernGroup

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Southern Cross' && train.viaCityLoop) // NME -> FGS -> CLP -> FSS -> SSS -> NME (Next trip)
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flagstaff' && !train.viaCityLoop) // NME -> SSS -> FSS -> CLP -> FGS -> NME (Next trip)
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flinders Street') {
    if (train.viaCityLoop) {
      possibleDestinations.push('Southern Cross')
    } else { // NME -> SSS -> FSS -> CLP -> FGS -> NME (Next trip)
      possibleDestinations.push('Flagstaff')
    }
  }

  let trip

  if (stationName === 'Southern Cross' && train.runDestination !== 'Flinders Street') {
    // Look for SSS -> FSS -> SSS reverse stunt
    // These reverse runs seem to always be on the same line (so SUY->SUY for eg)
    // Especially problematic with P13 as it is UP only, but down trips can be given from there
    // Do not perform the checks on P14 as it will correctly show the DOWN trips
    if (train.platform !== '14') {
      trip = await matchTrip({
        ...train,
        direction: 'Up'
      }, stopGTFSID, db, possibleLines, ['Flinders Street'])
    }
  }

  if (!trip) {
    trip = await matchTrip(train, stopGTFSID, db, possibleLines, possibleDestinations)
  }

  return trip
}

async function verifyTrainLoopRunning(train) {
  if (dandenongGroup.includes(train.routeName)) {
    let departureDay = await getDayOfWeek(train.originDepartureTime)
    if (4200 <= train.runID && train.runID <= 4299) { // DNG - CBE Shuttles
      if (departureDay === 'Sat' || departureDay === 'Sun') {
        train.viaCityLoop = false
      }
    } else if (6999 < train.runID && train.runID < 7999) { // Specials, these still follow regular conventions
      let loopIndicator = train.runID[1]
      train.viaCityLoop = loopIndicator > 5
    } else { // Look for city loop skipping a/c scheduled works
      let fssIndex = train.allStops.indexOf('Flinders Street')
      if (train.direction === 'Up' && fssIndex !== -1) {
        let parIndex = train.allStops.indexOf('Parliament')
        train.viaCityLoop = parIndex < fssIndex && parIndex !== -1 // PAR before FSS
      }
    }
  }
}

async function applyLoopSkipping(train, notifyData) {
  let { routeName } = train

  if (notifyData.cityLoopSkipping.includes(train.runID) || notifyData.broadCityLoopSkipping.includes(routeName)) {
    let isCityTrain = train.trip.stopTimings.some(stop => stop.stopName === 'Flinders Street Railway Station')

    if (isCityTrain) {
      train.viaCityLoop = false
      train.isSkippingLoop = true
      if (northernGroup.includes(routeName)) { // NME - SSS - FSS
        train.cityLoopRunning = ['NME', 'SSS', 'FSS']
      } else if (cliftonHillGroup.includes(routeName)) { // JLI - FSS
        train.cityLoopRunning = ['JLI', 'FSS']
      } else { // RMD - FSS
        train.cityLoopRunning = ['RMD', 'FSS']
      }

      if (train.direction === 'Down') train.cityLoopRunning.reverse()
    }
  }

  if (notifyData.altonaLoopSkipping.includes(train.runID) || notifyData.broadAltonaLoopSkipping) {
    if (train.viaAltonaLoop) {
      train.viaAltonaLoop = false
      train.isSkippingLoop = true
      train.altonaLoopRunning = ['LAV', 'NPT']

      if (train.direction === 'Down') train.altonaLoopRunning.reverse()
    }
  }

}

function returnBusDeparture(bus, trip) {
  let destination = trip.destination.slice(0, -16)

  return {
    scheduledDepartureTime: bus.scheduledDepartureTime,
    estimatedDepartureTime: null,
    actualDepartureTime: bus.scheduledDepartureTime,
    fleetNumber: null,
    runID: null,
    ptvRunID: bus.ptvRunID,
    platform: null,
    cancelled: null,
    routeName: bus.routeName,
    codedRouteName: utils.encodeName(bus.routeName),
    trip,
    destination,
    direction: bus.direction,
    runDestination: destination,
    viaCityLoop: null,
    viaAltonaLoop: null,
    isRailReplacementBus: true,
    suspension: null,
    isSkippingLoop: null
  }
}

async function getMissingRailBuses(mappedBuses, metroPlatform, db) {
  let {stopGTFSID} = metroPlatform
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let extrasByTime = await async.map(mappedBuses, async bus => {
    let departureTimeMinutes = utils.getMinutesPastMidnight(bus.scheduledDepartureTime)
    let searchDays = departureTimeMinutes < 180 ? 1 : 0

    for (let i = 0; i <= searchDays; i++) {
      let day = bus.scheduledDepartureTime.clone().add(-i, 'days')

      let potentialBuses = await gtfsTimetables.findDocuments({
        operationDays: utils.getYYYYMMDD(day),
        mode: 'metro train',
        stopTimings: {
          $elemMatch: {
            stopGTFSID,
            departureTimeMinutes: departureTimeMinutes + 1440 * i
          }
        },
        direction: bus.direction,
        routeGTFSID: bus.trip.routeGTFSID
      }).limit(3).toArray()

      let extras = potentialBuses.filter(extra => !utils.tripsEqual(bus.trip, extra))

      return extras.map(extra => {
        // It has all the same propeties as the original bus just a different trip
        return returnBusDeparture(bus, extra)
      })
    }
  })

  return extrasByTime.reduce((a, e) => a.concat(e), [])
}

async function expandSkeleton(bus, allBuses, db) {
  let {originalBus} = bus

  let matchingDeparture = allBuses.find(potentialMatch => {
    return originalBus.scheduledDepartureTime.isSame(potentialMatch.scheduledDepartureTime)
      && originalBus.direction === potentialMatch.direction
      && bus.possibleLines.includes(potentialMatch.routeName)
  })

  if (matchingDeparture) return
  let trip = await getStoppingPattern({
    ptvRunID: originalBus.ptvRunID,
    time: originalBus.scheduledDepartureTime.toISOString()
  }, db)

  return returnBusDeparture(originalBus, trip)
}

async function mapBus(bus, metroPlatform, db) {
  let {stopGTFSID} = metroPlatform

  let destination = bus.runDestination

  let possibleLines = lineGroups.find(group => group.includes(bus.routeName)) || bus.routeName
  let trip = await matchTrip(bus, stopGTFSID, db, possibleLines, [destination])

  if (trip) {
    return returnBusDeparture(bus, trip)
  } else {
    // No trip - could be fake trips from PTV (eg buses NME-WER, SUY will show NME-FSY)
    return {
      skeleton: true,
      destination,
      possibleLines,
      stopGTFSID,
      originalBus: bus
    }
  }
}

async function getSTYRunID(trip, db) {
  let timetables = db.getCollection('timetables')
  let wttTrip = await timetables.findDocument({
    mode: 'metro train',
    routeGTFSID: trip.routeGTFSID,
    direction: trip.direction,
    departureTime: trip.departureTime
  })

  if (wttTrip) return wttTrip.runID
}

async function mapTrain(train, metroPlatform, notifyData, db) {
  let {stopGTFSID} = metroPlatform
  let stationName = metroPlatform.fullStopName.slice(0, -16)
  let isInLoop = cityLoopStations.includes(stationName)

  let routeName = train.routeName
  let trip
  if (burnleyGroup.includes(routeName) || cliftonHillGroup.includes(routeName) || genericGroup.includes(routeName)) {
    trip = await genericMatch(train, stopGTFSID, stationName, db)
  } else if (caulfieldGroup.includes(routeName)) {
    trip = await cfdGroupMatch(train, stopGTFSID, stationName, db)
  } else if (northernGroup.includes(routeName)) {
    trip = await norGroupMatch(train, stopGTFSID, stationName, db)
  }

  if (!trip) {
    // Rewrite specifically for metro
    trip = await getStoppingPattern({
      ptvRunID: train.ptvRunID,
      time: train.scheduledDepartureTime.toISOString()
    }, db)
  }

  if (train.routeName === 'Stony Point') {
    train.runID = await getSTYRunID(trip, db)
  }

  let relevantAlerts = notifyData.trainAlterations.filter(alteration => alteration.runID === train.runID)
  let tripAlerts = trip.notifyAlerts || []

  if (relevantAlerts.some(alert => !tripAlerts.includes(alert.alertID))) {
    trip = await getStoppingPattern({
      ptvRunID: train.ptvRunID,
      time: train.scheduledDepartureTime.toISOString()
    }, db)
  }

  let viaAltonaLoop = null
  if (train.routeName === 'Werribee') {
    let isNPTTrain = trip.stopTimings.some(stop => stop.stopName === 'Newport Railway Station')
    let isLAVTrain = trip.stopTimings.some(stop => stop.stopName === 'Laverton Railway Station')

    if (isNPTTrain && isLAVTrain) {
      viaAltonaLoop = trip.stopTimings.some(stop => stop.stopName === 'Altona Railway Station')
    }

    if (isNPTTrain !== isLAVTrain) { // We only have one of NPT or LAV
      let isWERTrain = trip.stopTimings.some(stop => stop.stopName === 'Werribee Railway Station')
      let isFSYTrain = trip.stopTimings.some(stop => stop.stopName === 'Footscray Railway Station')

      viaAltonaLoop = !(isWERTrain || isFSYTrain) // We are expressing one of NPT or LAV
    }
  }

  return {
    scheduledDepartureTime: train.scheduledDepartureTime,
    estimatedDepartureTime: train.estimatedDepartureTime,
    actualDepartureTime: train.estimatedDepartureTime || train.scheduledDepartureTime,
    fleetNumber: train.fleetNumber,
    runID: train.runID,
    ptvRunID: train.ptvRunID,
    platform: train.platform,
    cancelled: train.cancelled,
    routeName: train.routeName,
    codedRouteName: utils.encodeName(train.routeName),
    trip,
    destination: trip.trueDestination.slice(0, -16),
    direction: train.direction,
    runDestination: train.runDestination,
    viaCityLoop: train.viaCityLoop,
    viaAltonaLoop,
    isRailReplacementBus: false,
    suspension: null,
    isSkippingLoop: null
  }
}

function determineLoopRunning(runID, routeName, direction) {
  let viaCityLoop
  let loopIndicator = runID[1]

  if (dandenongGroup.includes(routeName)) {
    if (3999 < runID && runID < 4105) {
      viaCityLoop = direction === 'Up'
    } else if (4179 < runID && runID < 4200) { // Night network, loop closed
      viaCityLoop = false
    } else if (runID < 4265) {
      viaCityLoop = direction === 'Up'
    } else if (4599 < runID && runID < 4800) {
      viaCityLoop = direction === 'Up'
    }
  } else {
    viaCityLoop = loopIndicator > 5
  }

  return viaCityLoop
}

function appendDepartureDay(departure, stopGTFSID) {
  let { trip } = departure
  let stopData = trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
  if (!stopData) return global.loggers.general.warn('No departure day', departure, stopGTFSID)

  let firstStop = trip.stopTimings[0]
  let fssStop = trip.stopTimings.find(tripStop => tripStop.stopName === 'Flinders Street Railway Station')
  if (trip.direction === 'Down' && fssStop) firstStop = fssStop

  let originDepartureMinutes = firstStop.departureTimeMinutes
  let stopDepartureMinutes = stopData.departureTimeMinutes || stopData.arrivalTimeMinutes
  let minutesDiff = stopDepartureMinutes - originDepartureMinutes
  let originDepartureTime = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')

  departure.originDepartureTime = originDepartureTime
  departure.departureDay = utils.getYYYYMMDD(originDepartureTime)
  departure.trueDepartureDay = departure.departureDay
  if (originDepartureMinutes >= 1440) {
    departure.departureDay = utils.getYYYYMMDD(originDepartureTime.clone().add(-1, 'day'))
  }
}

function findUpcomingStops(departure, stopGTFSID) {
  let tripStops = departure.trip.stopTimings
  let currentIndex = tripStops.findIndex(stop => stop.stopGTFSID === stopGTFSID)
  let stopNames = tripStops.map(stop => stop.stopName.slice(0, -16))
  let futureStops = stopNames.slice(currentIndex + 1)

  departure.allStops = stopNames
  departure.futureStops = futureStops
}


async function saveConsists(departures, db) {
  let metroTrips = db.getCollection('metro trips')
  let runIDsSeen = []
  let deduped = departures.filter(departure => {
    if (!runIDsSeen.includes(departure.runID) && departure.fleetNumber) {
      runIDsSeen.push(departure.runID)
      return true
    } else {
      return false
    }
  })

  await async.forEach(deduped, async departure => {
    let query = {
      date: departure.departureDay,
      runID: departure.runID
    }

    let tripData = {
      ...query,
      origin: departure.trip.trueOrigin.slice(0, -16),
      destination: departure.trip.trueDestination.slice(0, -16),
      departureTime: departure.trip.trueDepartureTime,
      destinationArrivalTime: departure.trip.trueDestinationArrivalTime,
      consist: departure.fleetNumber
    }

    await metroTrips.replaceDocument(query, tripData, {
      upsert: true
    })
  })
}

async function saveSuspensions(suspensionAffectedTrains, db) {
  let liveTimetables = db.getCollection('live timetables')

  await async.forEach(suspensionAffectedTrains, async train => {
    let {trip} = train

    let query = {
      operationDays: train.departureDay,
      mode: 'metro train',
      runID: trip.runID
    }

    let newTrip = {
      ...trip,
      operationDays: train.departureDay
    }

    delete newTrip._id

    await liveTimetables.replaceDocument(query, newTrip, {
      upsert: true
    })
  })
}

async function removeResumedSuspensions(nonSuspendedTrains, db) {
  let liveTimetables = db.getCollection('live timetables')

  await async.forEach(nonSuspendedTrains, async train => {
    let {trip} = train

    let query = {
      operationDays: train.departureDay,
      mode: 'metro train',
      runID: {
        $in: [
          train.runID + 'U',
          train.runID + 'B',
          train.runID + 'D'
        ]
      }
    }

    await liveTimetables.deleteDocuments(query)
  })
}

async function saveRailBuses(buses, db) {
  let liveTimetables = db.getCollection('live timetables')

  await async.forEach(buses, async bus => {
    let {trip} = bus

    let query = {
      operationDays: bus.departureDay,
      trueDepartureTime: trip.trueDepartureTime,
      trueDestinationArrivalTime: trip.trueDestinationArrivalTime,
      trueOrigin: trip.trueOrigin,
      trueDestination: trip.trueDestination,
      mode: 'metro train'
    }

    let newTrip = {
      ...trip,
      operationDays: bus.departureDay,
      isRailReplacementBus: true
    }

    delete newTrip._id

    await liveTimetables.replaceDocument(query, newTrip, {
      upsert: true
    })
  })
}

function parsePTVDepartures(ptvResponse, stationName) {
  let {departures, runs, routes, directions} = ptvResponse
  let now = utils.now()

  return departures.map(departure => {
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null

    if (scheduledDepartureTime.diff(now, 'minutes') > 110) return null

    let platform = departure.platform_number
    let ptvRunID = departure.run_ref

    let run = runs[ptvRunID]
    let route = routes[departure.route_id]
    let directionData = directions[departure.direction_id]

    let cancelled = run.status === 'cancelled'
    let vehicleDescriptor = run.vehicle_descriptor || {}
    let isRailReplacementBus = departure.flags.includes('RRB-RUN')

    let fleetNumber = null
    if (!isRailReplacementBus) {
      if (vehicleDescriptor) {
        fleetNumber = findConsist(vehicleDescriptor.id)
      }
    }

    let routeName = route.route_name
    if (routeName.includes('Showgrounds')) routeName = 'Showgrounds/Flemington'
    if (route.route_id === 99) routeName = 'City Circle'
    let runDestination = run.destination_name.trim()

    let direction = directionData.direction_name.includes('City') ? 'Up' : 'Down'
    if (routeName === 'Stony Point') direction = runDestination === 'Frankston' ? 'Up' : 'Down'
    if (routeName === 'City Circle') direction = 'Down'

    let viaCityLoop = null
    let runID = null
    if (ptvRunID > 948000) {
      runID = utils.getRunID(ptvRunID)
      viaCityLoop = determineLoopRunning(runID, routeName, direction)
    }

    if (stationName === 'Flemington Racecourse' && platform === '4') platform = '2' // 4 Road is Platform 2
    if (stationName === 'Merinda Park' && platform === '1') platform = '2' // Match physical signage

    return {
      scheduledDepartureTime,
      estimatedDepartureTime,
      platform,
      cancelled,
      fleetNumber,
      isRailReplacementBus,
      routeName,
      runDestination,
      ptvRunID,
      runID,
      direction,
      viaCityLoop
    }
  }).filter(Boolean)
}

async function getDeparturesFromPTV(station, db) {
  let notifyData = await getNotifyData(db)
  let metroPlatform = station.bays.find(bay => bay.mode === 'metro train')
  let stationName = metroPlatform.fullStopName.slice(0, -16)

  let url = `/v3/departures/route_type/0/stop/${metroPlatform.stopGTFSID}?gtfs=true&max_results=15&include_cancelled=true&expand=Direction&expand=Run&expand=Route&expand=VehicleDescriptor`
  let ptvResponse = await ptvAPI(url)

  let parsedDepartures = parsePTVDepartures(ptvResponse, stationName)

  let replacementBuses = parsedDepartures.filter(departure => departure.isRailReplacementBus)
  let trains = parsedDepartures.filter(departure => !departure.isRailReplacementBus)

  let initalMappedBuses = await async.map(replacementBuses, async bus => await mapBus(bus, metroPlatform, db))
  let initialMappedTrains = await async.map(trains, async train => await mapTrain(train, metroPlatform, notifyData, db))
  let suspensionMappedTrains = await async.map(initialMappedTrains, async train => await applySuspension(train, notifyData, metroPlatform, db))

  let nonSkeleton = initalMappedBuses.filter(bus => !bus.skeleton)
  let mappedBuses = (await async.map(initalMappedBuses, async bus => {
    if (bus.skeleton) return await expandSkeleton(bus, nonSkeleton, db)
    else return bus
  })).filter(Boolean)

  let extraBuses = await getMissingRailBuses(mappedBuses, metroPlatform, db)
  let mappedTrains = suspensionMappedTrains.filter(departure => !departure.isRailReplacementBus)
  let suspensionBuses = suspensionMappedTrains.filter(departure => departure.isRailReplacementBus)
  let allRailBuses = [...mappedBuses, ...extraBuses, ...suspensionBuses]

  let allDepartures = [...mappedTrains, ...allRailBuses]

  allDepartures.forEach(departure => {
    appendDepartureDay(departure, metroPlatform.stopGTFSID)
    findUpcomingStops(departure, metroPlatform.stopGTFSID)
  })

  await saveConsists(mappedTrains, db)
  await saveSuspensions(suspensionMappedTrains.filter(departure => departure.trip.suspension && !departure.isRailReplacementBus), db)
  await removeResumedSuspensions(suspensionMappedTrains.filter(departure => !departure.trip.suspension), db)
  await saveRailBuses(allRailBuses, db)

  await async.forEach(mappedTrains, async train => {
    await verifyTrainLoopRunning(train)

    if (train.destination === 'Flinders Street' && train.viaCityLoop && !cityStations.includes(stationName)) {
      train.destination = 'City Loop'
    }

    if (train.routeName === 'City Circle' && stationName === 'Flinders Street') {
      train.destination = 'City Circle'
    }

    let isCityTrain = [
      train.trip.trueOrigin.slice(0, -16),
      train.trip.trueDestination.slice(0, -16)
    ].some(stop => cityStations.includes(stop))

    if (isCityTrain) addCityLoopRunning(train, stationName)
    if (train.routeName === 'Werribee') addAltonaLoopRunning(train)
    if (train.routeName === 'Stony Point') addStonyPointPlatform(train, stationName)

    await applyLoopSkipping(train, notifyData)
  })

  return allDepartures
}

async function getDepartures(station, db, filter) {
  try {
    throw new Error('a')
    if (typeof filter === 'undefined') filter = true

    return await utils.getData('metro-departures-new', station.stopName, async () => {
      let departures = await getDeparturesFromPTV(station, db)

      return filterDepartures(departures, filter)
    })
  } catch (e) {
    global.loggers.general.err('Error getting Metro departures', e)
    try {
      return await departureUtils.getScheduledMetroDepartures(station, db)
    } catch (ee) {
      global.loggers.general.err('Error getting Scheduled Metro departures', ee)
      return null
    }
  }
}

module.exports = getDepartures
