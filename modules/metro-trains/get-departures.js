const async = require('async')
const ptvAPI = require('../../ptv-api')
const utils = require('../../utils')
const config = require('../../config')
const findConsist = require('./fleet-parser')
const departureUtils = require('../utils/get-train-timetables-new')
const fixTripDestination = require('./fix-trip-destinations')
const getStoppingPattern = require('./get-stopping-pattern')
const getRouteStops = require('../../additional-data/route-stops')
const { getDayOfWeek } = require('../../public-holidays')
const mergeConsist = require('./merge-consist')

let undergroundLoopStations = ['Parliament', 'Flagstaff', 'Melbourne Central']
let cityLoopStations = ['Southern Cross', ...undergroundLoopStations]
let cityStations = [...cityLoopStations, 'Flinders Street']

let cityLoopGTFSIDs = [
  19843, // Parliament
  19842, // Melb Central
  19841, // Flagstaff
  22180 // Southern Cross
]

let burnleyGroup = ['Alamein', 'Belgrave', 'Glen Waverley', 'Lilydale']
let caulfieldGroup = ['Frankston', 'Cranbourne', 'Pakenham', 'Sandringham']
let dandenongGroup = ['Cranbourne', 'Pakenham']
let northernGroup = ['Craigieburn', 'Sunbury', 'Upfield', 'Showgrounds/Flemington', 'Flemington Racecourse', 'Werribee', 'Williamstown']
let cliftonHillGroup = ['Mernda', 'Hurstbridge']
let genericGroup = ['City Circle', 'Stony Point']

let lineGroups = [
  burnleyGroup, caulfieldGroup,
  northernGroup, cliftonHillGroup,
  genericGroup
]

let stationsAppendingUp = [
  'Richmond', 'North Melbourne', 'South Yarra'
]

let rceStations = [
  'Flemington Racecourse',
  'Showgrounds',
  'Newmarket',
  'Kensington',
  'North Melbourne',
  'Southern Cross',
  'Flinders Street'
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
      } else if (runDestination === 'Flagstaff' || undergroundLoopStations.includes(stationName)) {
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
      if (stationName === 'Southern Cross' && routeName === 'Frankston') {
        loopRunning = ['RMD', 'FSS', 'SSS', 'NME']
      } else if (runDestination === 'Southern Cross') {
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
    .match(/(?:trains|between) ([ \w]+) and ([ \w\/]+) (?:stations|due)/i)

  if (!stationsAffected) return []
  let startStation = utils.titleCase(stationsAffected[1].replace('between', '').trim())
  let endStations = stationsAffected[2].trim()

  // Station A should always be on the UP end
  let routeStops = getRouteStops(routeName)
  let startIndex = routeStops.indexOf(startStation)
  if (startIndex === -1) return []

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

  disruptions.forEach(disruption => {
    disruption.text = disruption.text.replace(/<\/?\w+>/g, '')
  })

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
    return disruption.routeName[0] === 'Stony Point' && (text.includes('replace') || text.includes('coach') || text.includes('bus'))
  }).map(disruption => disruption.runID)

  let loopSkipping = allTrainAlterations.filter(disruption => {
    let { text } = disruption
    return text.includes('direct')
      || (text.includes('express') && isAltonaLoop(disruption))
  })

  let trainAlterations = allTrainAlterations.filter(disruption => {
    let text = disruption.text
    return (!text.includes('maintenance') && !text.includes('works') && !text.includes('cancel') && !loopSkipping.includes(disruption) && !stonyPointReplacements.includes(disruption.runID))
      || text.includes('originate') || text.includes('terminate') || text.includes('express') || text.includes('not stop')
  })

  let cityLoopSkipping = loopSkipping.filter(isCityLoop).map(disruption => disruption.runID)
  let altonaLoopSkipping = loopSkipping.filter(isAltonaLoop).map(disruption => disruption.runID)

  let broadLoopSkipping = disruptions.filter(disruption => {
    return disruption.type !== 'works' && !disruption.runID
      && disruption.text.includes('direct')
      && disruption.text.toLowerCase().includes('all ')
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
  if (startIndex === -1 && endIndex === -1) {
    return null
  }

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

async function applySuspension(train, notifyData, metroPlatforms, db) {
  if (notifyData.suspendedLines.includes(train.routeName)) {
    let rawSuspension = notifyData.suspensions[train.routeName][0]
    let suspension = adjustSuspension(rawSuspension, train.trip, metroPlatforms[0].fullStopName)

    if (suspension) {
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
    }
  } else if (train.routeName === 'Stony Point' && notifyData.stonyPointReplacements.includes(train.runID)) {
    train.isRailReplacementBus = true
    train.trip.runID = train.runID + 'B'
  } else {
    train.suspension = null
    train.trip.suspension = null
  }

  return train
}

function filterDepartures(departures, filter, backwards, departureTime) {
  let filteredDepartures = departures
  if (filter) {
    filteredDepartures = departures.filter(departure => {
      let secondsDiff = departure.actualDepartureTime.diff(departureTime, 'seconds')

      if (backwards) return -5400 < secondsDiff && secondsDiff < 30
      else return -30 < secondsDiff && secondsDiff < 5400 // 1.5 hours
    })
  }

  let sorted = filteredDepartures.sort((a, b) => {
    let aLastStop = a.trip.stopTimings[a.trip.stopTimings.length - 1]
    let bLastStop = b.trip.stopTimings[b.trip.stopTimings.length - 1]

    return a.actualDepartureTime - b.actualDepartureTime
      || a.destination.localeCompare(b.destination)
      || aLastStop.arrivalTimeMinutes - bLastStop.arrivalTimeMinutes
  })

  if (backwards) sorted.reverse()
  return sorted
}

async function matchTrip(train, stopGTFSIDs, db, possibleLines, originalLine, possibleDestinations) {
  let fullPossibleDestinations = possibleDestinations.map(dest => dest + ' Railway Station')

  let data = {
    stopGTFSID: { $in: stopGTFSIDs },
    possibleLines,
    originalLine,
    departureTime: train.scheduledDepartureTime,
    possibleDestinations: fullPossibleDestinations,
    direction: train.direction,
    viaCityLoop: train.viaCityLoop
  }

  let liveDeparture = await departureUtils.getLiveDeparture(data, db)
  let gtfsDeparture = await departureUtils.getScheduledDeparture(data, db)
  if (liveDeparture && gtfsDeparture) {
    if (liveDeparture.routeName !== originalLine && gtfsDeparture.routeName == originalLine) {
      return gtfsDeparture
    } else {
      return liveDeparture
    }
  } else {
    return liveDeparture || gtfsDeparture
  }
}

async function genericMatch(train, stopGTFSIDs, stationName, db) {
  let possibleLines = lineGroups.find(group => group.includes(train.routeName)) || train.routeName

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Parliament') // RMD/JLI -> FSS -> CLP -> PAR
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flinders Street' && !train.viaCityLoop)
    possibleDestinations.push('Parliament')

  let trip = await matchTrip(train, stopGTFSIDs, db, possibleLines, train.routeName, possibleDestinations)
  return trip
}

async function cfdGroupMatch(train, stopGTFSIDs, stationName, db) {
  let possibleLines = caulfieldGroup

  let possibleDestinations = [train.runDestination]
  if (train.runDestination === 'Parliament') // RMD -> FSS -> CLP -> PAR
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Pakenham')
    possibleDestinations.push('East Pakenham')

  if (train.runDestination === 'Southern Cross' && !train.viaCityLoop) // RMD -> FSS -> SSS -> NPT (Occo Only)
    possibleDestinations.push('Flinders Street')

  if (train.runDestination === 'Flagstaff' && train.viaCityLoop) // RMD -> CLP -> FSS -> PAR -> CLP -> FGS -> NME
    possibleDestinations.push('Flinders Street')

  let trip = await matchTrip(train, stopGTFSIDs, db, possibleLines, train.routeName, possibleDestinations)
  return trip
}

async function norGroupMatch(train, stopGTFSIDs, stationName, db) {
  let possibleLines = northernGroup

  let possibleDestinations = [train.runDestination]
  if (train.direction === 'Down' && train.routeName === 'Flemington Racecourse') {
    possibleDestinations.push('Showgrounds')
    possibleDestinations.push('Flemington Racecourse')
  }

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
    if (train.platform === '13' && train.direction === 'Down') {
      trip = await matchTrip({
        ...train,
        direction: 'Up'
      }, stopGTFSIDs, db, possibleLines, train.routeName, ['Flinders Street'])
    }
  }

  if (!trip) {
    trip = await matchTrip(train, stopGTFSIDs, db, possibleLines, train.routeName, possibleDestinations)

    // RCE trains match weirdly especially in the city - be strict with requirements
    if (train.runID && train.runID[0] === 'R' && trip && trip.routeName !== 'Flemington Racecourse') trip = null
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
      else train.destination = 'Flinders Street'
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
    isSkippingLoop: null,
    location: null
  }
}

async function getMissingRailBuses(mappedBuses, metroPlatforms, db) {
  let stopGTFSIDs = metroPlatforms.map(plat => plat.stopGTFSID)
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
            stopGTFSID: { $in : stopGTFSIDs },
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

async function mapBus(bus, metroPlatforms, db) {
  let stopGTFSIDs = metroPlatforms.map(plat => plat.stopGTFSID)

  let destination = bus.runDestination

  let possibleLines = lineGroups.find(group => group.includes(bus.routeName)) || bus.routeName
  let trip = await matchTrip(bus, stopGTFSIDs, db, possibleLines, bus.routeName, [destination])

  if (trip) {
    return returnBusDeparture(bus, trip)
  } else {
    // No trip - could be fake trips from PTV (eg buses NME-WER, SUY will show NME-FSY)
    return {
      skeleton: true,
      destination,
      possibleLines,
      stopGTFSID: stopGTFSIDs[0],
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

async function mapTrain(train, metroPlatforms, notifyData, db) {
  let stopGTFSIDs = metroPlatforms.map(plat => plat.stopGTFSID)
  let stationName = metroPlatforms[0].fullStopName.slice(0, -16)
  let isInLoop = cityLoopStations.includes(stationName)

  let routeName = train.routeName
  let trip
  if (burnleyGroup.includes(routeName) || cliftonHillGroup.includes(routeName) || genericGroup.includes(routeName)) {
    trip = await genericMatch(train, stopGTFSIDs, stationName, db)
  } else if (caulfieldGroup.includes(routeName)) {
    trip = await cfdGroupMatch(train, stopGTFSIDs, stationName, db)
  } else if (northernGroup.includes(routeName)) {
    trip = await norGroupMatch(train, stopGTFSIDs, stationName, db)
  }

  if (!trip) {
    return null
    trip = await getStoppingPattern({
      routeName,
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
      routeName,
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
    isSkippingLoop: null,
    location: train.location,
    notifyAlerts: relevantAlerts,
    tripAlerts
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

function appendDepartureDay(departure, metroPlatforms) {
  let stopGTFSIDs = metroPlatforms.map(plat => plat.stopGTFSID)
  let { trip } = departure
  let stopData = trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))
  let firstStop = trip.stopTimings.find(tripStop => tripStop.stopName === trip.trueOrigin)
  let originDepartureMinutes = firstStop.departureTimeMinutes

  let originDepartureTime
  if (!stopData) {
    // global.loggers.general.warn('No departure day', stopGTFSID, departure)
    let departureTimeMinutes = utils.getMinutesPastMidnight(departure.scheduledDepartureTime)
    if (departureTimeMinutes >= 180) { // 3am - midnight

      // As expected, means no 3am stuff
      // Or we are in the loop past 3am meaning the next trip is definitely past 3am
      if (departureTimeMinutes > originDepartureMinutes || cityLoopGTFSIDs.includes(stopGTFSID)) {
        originDepartureTime = departure.scheduledDepartureTime.clone().startOf('day').add(originDepartureMinutes, 'minutes')
      } else { // Our stop is past 3am but the day is PREVIOUS DAY
        originDepartureTime = departure.scheduledDepartureTime.clone().startOf('day').add(originDepartureMinutes - 1440, 'minutes')
      }
    } else { // midnight - 3am
      if (originDepartureMinutes < 180) { // Departure is also midnight - 3am
        originDepartureTime = departure.scheduledDepartureTime.clone().startOf('day').add(originDepartureMinutes, 'minutes')
      } else { // Departure is 3am - midnight PREVIOUS DAY
        originDepartureTime = departure.scheduledDepartureTime.clone().startOf('day').add(originDepartureMinutes - 1440, 'minutes')
      }
    }
  } else {
    let stopDepartureMinutes = stopData.departureTimeMinutes || stopData.arrivalTimeMinutes
    let minutesDiff = stopDepartureMinutes - originDepartureMinutes
    originDepartureTime = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
  }

  departure.originDepartureTime = originDepartureTime
  departure.departureDay = utils.getYYYYMMDD(originDepartureTime)
  departure.trueDepartureDay = departure.departureDay
  if (originDepartureMinutes >= 1440) {
    departure.departureDay = utils.getYYYYMMDD(originDepartureTime.clone().add(-1, 'day'))
  }
}

function findUpcomingStops(departure, metroPlatforms) {
  let stopGTFSIDs = metroPlatforms.map(plat => plat.stopGTFSID)
  let tripStops = departure.trip.stopTimings
  let stopNames = tripStops.map(stop => stop.stopName.slice(0, -16))

  let currentIndex = tripStops.findIndex(stop => stopGTFSIDs.includes(stop.stopGTFSID))
  let originIndex = stopNames.indexOf(departure.trip.trueOrigin.slice(0, -16))
  let destinationIndex = stopNames.lastIndexOf(departure.trip.trueDestination.slice(0, -16))

  let futureStops = tripStops.slice(currentIndex + 1, destinationIndex + 1)
    .filter(stop => !stop.cancelled).map((stop, i) => stop.stopName.slice(0, -16))

  departure.allStops = stopNames.slice(originIndex, destinationIndex + 1)
  departure.futureStops = futureStops

  if (currentIndex === -1) {
    global.loggers.general.warn('Dropped Shorted metro run', departure.runID, {
      stop: metroPlatforms[0].stopName,
      departureTime: departure.scheduledDepartureTime
    })
    departure.shortenedAndRemove = true
  }
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
    if (!departure.departureDay) return global.loggers.error.err('No date on trip', departure)

    departure.fleetNumber = await mergeConsist(departure.trip, departure.runID, departure.departureDay, departure.fleetNumber, metroTrips)
  })
}

async function saveLocations(departures, db) {
  let metroLocations = db.getCollection('metro locations')
  let consists = {}

  departures.forEach(departure => {
    if (departure.fleetNumber) {
      let fleet = departure.fleetNumber.join('-')
      if (!consists[fleet]) {
        consists[fleet] = departure
      } else {
        let existingExpiry = consists[fleet].location.expiry
        let currentExpiry = departure.location.expiry

        if (currentExpiry > existingExpiry) consists[fleet] = departure
      }
    }
  })

  let deduped = Object.values(consists).reduce((a, e) => a.concat(e), [])

  await async.forEach(deduped, async departure => {
    let parts = []
    if (departure.fleetNumber.length === 6) {
      parts = [departure.fleetNumber.slice(0, 3), departure.fleetNumber.slice(3, 6)]
    } else {
      parts = [departure.fleetNumber]
    }

    await async.forEach(parts, async train => {
      let locationData = {
        consist: train,
        timestamp: +new Date(),
        location: {
          type: "Point",
          coordinates: [
            departure.location.longitude,
            departure.location.latitude
          ]
        },
        bearing: departure.location.bearing
      }

      await metroLocations.replaceDocument({
        consist: train[0]
      }, locationData, {
        upsert: 1
      })
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

    let deletionQuery = {
      ...query,
      runID: trip.runID.slice(0, 4)
    }

    let newTrip = {
      ...trip,
      operationDays: train.departureDay
    }

    delete newTrip._id

    await liveTimetables.replaceDocument(query, newTrip, {
      upsert: true
    })

    await liveTimetables.deleteDocument(deletionQuery)
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

function parsePTVDepartures(ptvResponse, stationName, departureTime) {
  let {departures, runs, routes, directions} = ptvResponse
  return departures.map(departure => {
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null

    if (scheduledDepartureTime.diff(departureTime, 'minutes') > 110) return null
    if (scheduledDepartureTime.diff(departureTime, 'minutes') < -120) return null
    // When looking backwards skip those that are more than 2hr ago to avoid getting junk from previous days on low freq lines

    let platform = departure.platform_number
    let ptvRunID = departure.run_ref

    let run = runs[ptvRunID]
    let route = routes[departure.route_id]
    let directionData = directions[departure.direction_id]

    let cancelled = run.status === 'cancelled'
    let vehicleDescriptor = run.vehicle_descriptor || {}
    let isRailReplacementBus = departure.flags.includes('RRB-RUN')

    let routeName = route.route_name
    if (routeName.includes('Flemington')) routeName = 'Flemington Racecourse'
    if (route.route_id === 99) routeName = 'City Circle'
    let runDestination = run.destination_name.trim()

    if (!isRailReplacementBus && (!platform && routeName !== 'Stony Point')) return null // Avoid picking up PTV duplicated trips

    let direction = directionData.direction_name.includes('City') ? 'Up' : 'Down'
    if (routeName === 'Stony Point') direction = runDestination === 'Frankston' ? 'Up' : 'Down'
    if (routeName === 'City Circle') direction = 'Down'

    let location = run.vehicle_position ? {
      latitude: run.vehicle_position.latitude,
      longitude: run.vehicle_position.longitude,
      bearing: run.vehicle_position.bearing,
      expiry: +new Date(run.vehicle_position.expiry_time)
    } : null

    let viaCityLoop = null
    let runID = null
    if (ptvRunID > 948000) {
      runID = utils.getRunID(ptvRunID)
      viaCityLoop = determineLoopRunning(runID, routeName, direction)
    }

    if (stationName === 'Flemington Racecourse' && platform === '4') platform = '2' // 4 Road is Platform 2

    let fleetNumber = null
    if (!isRailReplacementBus && vehicleDescriptor) {
      fleetNumber = findConsist(vehicleDescriptor.id, runID)
    }

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
      viaCityLoop,
      location
    }
  }).filter(Boolean)
}

function dedupeRailReplacementBuses(replacementBuses) {
  let deduped = []
  return replacementBuses.filter(bus => {
    let id = bus.scheduledDepartureTime.toISOString() + bus.runDestination
    if (deduped.includes(id)) return false
    else {
      deduped.push(id)
      return true
    }
  })
}

function updateShortedDestination(train, stationName) {
  let destIndex = train.trip.stopTimings.findIndex(stop => stop.stopName === train.trip.trueDestination) + 1
  let nonCancelledStops = train.trip.stopTimings.slice(0, destIndex).filter(stop => !stop.cancelled)
  let cancelledStops = train.trip.stopTimings.slice(0, destIndex).filter(stop => stop.cancelled).map(stop => stop.stopName.slice(0, -16))
  let lastStop = nonCancelledStops[nonCancelledStops.length - 1]

  if (lastStop.stopName !== train.trip.trueDestination && !cancelledStops.includes(stationName)) {
    train.destination = lastStop.stopName.slice(0, -16)
  }

  if (cancelledStops.includes(stationName)) {
    train.cancelled = true
    train.estimatedDepartureTime = null
  }
}

async function getDeparturesFromPTV(station, backwards, departureTime, db) {
  let notifyData = await getNotifyData(db)
  let metroPlatforms = station.bays.filter(bay => bay.mode === 'metro train')

  let stationName = metroPlatforms[0].fullStopName.slice(0, -16)

  let url = `/v3/departures/route_type/0/stop/${metroPlatforms[0].stopGTFSID}?gtfs=true&max_results=15&include_cancelled=true&look_backwards=${backwards ? 'true' : 'false'}&expand=Direction&expand=Run&expand=Route&expand=VehicleDescriptor&expand=VehiclePosition&date_utc=${departureTime.toISOString()}`
  let ptvResponse = await ptvAPI(url)

  let parsedDepartures = parsePTVDepartures(ptvResponse, stationName, departureTime)

  let rawReplacementBuses = parsedDepartures.filter(departure => departure.isRailReplacementBus)
  let replacementBuses = dedupeRailReplacementBuses(rawReplacementBuses)

  let trains = parsedDepartures.filter(departure => !departure.isRailReplacementBus)

  let initalMappedBuses = await async.map(replacementBuses, async bus => await mapBus(bus, metroPlatforms, db))
  let initialMappedTrains = await async.map(trains, async train => await mapTrain(train, metroPlatforms, notifyData, db))
  let suspensionMappedTrains
  if (config.applyMetroSuspensions) {
    suspensionMappedTrains = await async.map(initialMappedTrains, async train => await applySuspension(train, notifyData, metroPlatforms, db))
  } else {
    suspensionMappedTrains = initialMappedTrains
  }

  let nonSkeleton = initalMappedBuses.filter(bus => !bus.skeleton)
  let mappedBuses = (await async.map(initalMappedBuses, async bus => {
    if (bus.skeleton) return await expandSkeleton(bus, nonSkeleton, db)
    else return bus
  })).filter(Boolean)

  let extraBuses = await getMissingRailBuses(mappedBuses, metroPlatforms, db)
  let mappedTrains = suspensionMappedTrains.filter(departure => !departure.isRailReplacementBus)
  let suspensionBuses = suspensionMappedTrains.filter(departure => departure.isRailReplacementBus)
  let allRailBuses = [...mappedBuses, ...extraBuses, ...suspensionBuses]

  let allDepartures = [...mappedTrains, ...allRailBuses]

  allDepartures.forEach(departure => {
    appendDepartureDay(departure, metroPlatforms)
    findUpcomingStops(departure, metroPlatforms)
  })

  allDepartures = allDepartures.filter(departure => !departure.shortenedAndRemove)

  await saveConsists(mappedTrains, db)
  await saveLocations(mappedTrains, db)
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
    updateShortedDestination(train, stationName)

    await applyLoopSkipping(train, notifyData)
  })

  return allDepartures
}

function generateTripID(trip) {
  return trip.trueOrigin + trip.trueDestination + trip.trueDepartureTime
}

async function getExtraTrains(departures, direction, scheduled, departureTime) {
  let inDirection = scheduled.filter(train => train.trip.direction === direction)
  let existingInDirection = departures.filter(train => train.trip.direction === direction)
  let existingIDs = existingInDirection.map(train => generateTripID(train.trip))

  let extras = inDirection.filter(train => {
    let id = generateTripID(train.trip)
    return !existingIDs.includes(id)
  })

  return extras.filter(train => {
    return train.actualDepartureTime.diff(departureTime, 'minutes') > 5 && !train.trip.h
  })
}

async function getMissingRaceTrains(departures, scheduled) {
  let raceTrains = scheduled.filter(train => train.trip.routeGTFSID === '2-RCE')
  let existingIDs = departures.filter(train => train.trip.routeGTFSID === '2-RCE').map(train => generateTripID(train.trip))

  let extras = raceTrains.filter(train => {
    let id = generateTripID(train.trip)
    return !existingIDs.includes(id)
  })

  return extras
}

async function getDepartures(station, db, filter, backwards, departureTime) {
  let stationName = station.stopName.slice(0, -16)
  try {
    if (typeof filter === 'undefined') filter = true
    if (typeof departureTime === 'undefined') departureTime = utils.now()

    let roundedTimeMS = +departureTime - (+departureTime % 30000)

    return await utils.getData('metro-departures-new', stationName + backwards + roundedTimeMS, async () => {
      let departures = await getDeparturesFromPTV(station, backwards, departureTime, db)
      let extraTrains = [], raceTrains = []

      let scheduled = await departureUtils.getScheduledMetroDepartures(station, db, departureTime, backwards)

      if (stationsAppendingUp.includes(stationName)) {
        extraTrains = await getExtraTrains(departures, 'Up', scheduled, departureTime)
      }

      if (rceStations.includes(stationName)) {
        raceTrains = await getMissingRaceTrains(departures, scheduled)
        raceTrains = raceTrains.filter(train => !extraTrains.includes(train))
      }

      return filterDepartures([...departures, ...extraTrains, ...raceTrains], filter, backwards, departureTime)
    })
  } catch (e) {
    global.loggers.general.err('Error getting Metro departures', e)
    try {
      return await utils.getData('metro-departures-new', stationName + backwards + departureTime.toISOString(), async () => {
        let scheduled = await departureUtils.getScheduledMetroDepartures(station, db, departureTime, backwards)
        return scheduled
      }, 1000 * 10)
    } catch (ee) {
      global.loggers.general.err('Error getting Scheduled Metro departures', ee)
      return null
    }
  }
}

module.exports = getDepartures
