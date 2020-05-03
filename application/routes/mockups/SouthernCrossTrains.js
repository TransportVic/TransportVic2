const TimedCache = require('timed-cache')
const async = require('async')
const urls = require('../../../urls.json')
const utils = require('../../../utils')
const moment = require('moment')
const cheerio = require('cheerio')
const termini = require('../../../additional-data/termini-to-lines')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const getLineStops = require('./route-stops')
const TrainUtils = require('./TrainUtils')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 1.5 })

const EventEmitter = require('events')

let apiLock = null

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

async function getStationFromVNETName(vnetStationName, db) {
  const station = await db.getCollection('stops').findDocument({
    bays: {
      $elemMatch: {
        mode: 'regional train',
        vnetStationName
      }
    }
  })

  return station
}

function getShortRouteName(trip) {
  let origin = trip.origin.slice(0, -16)
  let destination = trip.destination.slice(0, -16)
  let originDest = `${origin}-${destination}`

  return termini[originDest] || termini[origin] || termini[destination]
}

async function getVNETServices(vlinePlatform, isDepartures, db) {
  const {vnetStationName} = vlinePlatform

  let vnetURL
  if (isDepartures)
    vnetURL = urls.vlinePlatformDepartures.slice(0, -3).format(vnetStationName, 'D') + '1440'
  else
    vnetURL = urls.vlinePlatformArrivals.slice(0, -3).format(vnetStationName, 'U') + '1440'

  const body = (await utils.request(vnetURL)).replace(/a:/g, '')
  const $ = cheerio.load(body)
  const allServices = Array.from($('PlatformService'))

  let mappedDepartures = []

  await async.forEach(allServices, async service => {
    let estimatedDepartureTime

    function $$(q) {
      return $(q, service)
    }

    if (!isNaN(new Date($$('ActualArrivalTime').text()))) {
      estimatedDepartureTime = moment.tz($$('ActualArrivalTime').text(), 'Australia/Melbourne')
    } // yes arrival cos vnet

    let platform = $$('Platform').text()
    let originDepartureTime = moment.tz($$('ScheduledDepartureTime').text(), 'Australia/Melbourne')
    let destinationArrivalTime = moment.tz($$('ScheduledDestinationArrivalTime').text(), 'Australia/Melbourne')
    let runID = $$('ServiceIdentifier').text()
    let originVNETName = $$('Origin').text()
    let destinationVNETName = $$('Destination').text()

    let accessibleTrain = $$('IsAccessibleAvailable') === 'true'
    let barAvailable = $$('IsBuffetAvailable') === 'true'

    let vehicle = $$('Consist').text().replace(/ /g, '-')
    const vehicleConsist = $$('ConsistVehicles').text().replace(/ /g, '-')
    let fullVehicle = vehicle
    let vehicleType

    if (vehicle.startsWith('N')) {
      let carriages = vehicleConsist.slice(5).split('-')
      fullVehicle = vehicleConsist

      vehicleType = 'N +'
      vehicleType += carriages.length

      if (carriages.includes('N')) vehicleType += 'N'
      else vehicleType += 'H'
    } else if (vehicle.includes('VL')) {
      let cars = vehicle.split('-')
      fullVehicle = vehicle.replace(/\dVL/g, 'VL')

      vehicleType = cars.length + 'x 3VL'
    } else if (vehicle.match(/70\d\d/)) {
      let cars = vehicle.split('-')
      vehicleType = cars.length + 'x SP'
    }

    if ($$('Consist').attr('i:nil'))
      fullVehicle = ''

    let direction = $$('Direction').text()
    if (direction === 'D') direction = 'Down'
    else direction = 'Up'

    const originStation = await getStationFromVNETName(originVNETName, db)
    const destinationStation = await getStationFromVNETName(destinationVNETName, db)

    let originVLinePlatform = originStation.bays.find(bay => bay.mode === 'regional train')
    let destinationVLinePlatform = destinationStation.bays.find(bay => bay.mode === 'regional train')

    mappedDepartures.push({
      runID,
      originVNETName: originVLinePlatform.vnetStationName,
      destinationVNETName: destinationVLinePlatform.vnetStationName,
      origin: originVLinePlatform.fullStopName,
      destination: destinationVLinePlatform.fullStopName,
      originDepartureTime, destinationArrivalTime,
      platform, estimatedDepartureTime,
      direction,
      vehicle: fullVehicle,
      barAvailable,
      accessibleTrain,
      vehicleType
    })
  })

  return mappedDepartures
}

async function getServicesFromVNET(vlinePlatform, isDepartures, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')

  let vnetServices = await getVNETServices(vlinePlatform, isDepartures, db)

  let journeyCache = {}
  let stopGTFSID = vlinePlatform.stopGTFSID

  let departures = await async.map(vnetServices, async departure => {
    let dayOfWeek = utils.getDayName(departure.originDepartureTime)
    let operationDay = departure.originDepartureTime.format('YYYYMMDD')

    let nspTrip = await timetables.findDocument({
      operationDays: dayOfWeek,
      runID: departure.runID,
      mode: 'regional train'
    })

    let liveQuery = {
      operationDays: operationDay,
      runID: departure.runID,
      mode: 'regional train'
    }
    let staticQuery = {
      origin: departure.origin,
      destination: departure.destination,
      departureTime: utils.formatHHMM(departure.originDepartureTime),
      operationDays: operationDay,
      mode: 'regional train'
    }

    let trip = await db.getCollection('live timetables').findDocument(liveQuery)

    if (!trip) {
    trip = await db.getCollection('live timetables').findDocument(staticQuery)
    }

    if (!trip) {
      trip = await gtfsTimetables.findDocument(staticQuery)
    }

    if (!trip && nspTrip) trip = nspTrip

    if (!trip) {
      console.log(departure)
    }

    let platform = departure.platform

    if (trip.destination !== departure.destination) {
      let stoppingAt = trip.stopTimings.map(e => e.stopName)
      let destinationIndex = stoppingAt.indexOf(departure.destination)
      trip.stopTimings = trip.stopTimings.slice(0, destinationIndex + 1)
      let lastStop = trip.stopTimings[destinationIndex]

      trip.destination = lastStop.stopName
      trip.destinationArrivalTime = lastStop.arrivalTime
      lastStop.departureTime = null
      lastStop.departureTimeMinutes = null

      trip.runID = departure.runID
      trip.operationDays = operationDay

      delete trip._id
      await liveTimetables.replaceDocument({
        operationDays: operationDay,
        runID: departure.runID,
        mode: 'regional train'
      }, trip, {
        upsert: true
      })
    }

    trip.vehicleType = departure.vehicleType
    trip.vehicle = departure.vehicle

    return {
      type: 'vline',
      shortRouteName: getShortRouteName(trip),
      trip,
      platform,
      scheduledDepartureTime: departure.originDepartureTime,
      destinationArrivalTime: departure.destinationArrivalTime,
      estimatedDepartureTime: departure.estimatedDepartureTime,
      runID: departure.runID,
      vehicle: departure.vehicle,
      origin: trip.origin.slice(0, -16),
      destination: trip.destination.slice(0, -16),
      flags: {
        barAvailable: departure.barAvailable,
        accessibleTrain: departure.accessibleTrain
      },
      connections: []
    }
  })

  return departures
}

function filterPlatforms(services, platforms) {
  return services.filter(departure => {
    if (departure.type === 'vline') {
      if (!departure.platform) return null
      let mainPlatform = departure.platform.replace(/[A-Z]/, '')

      return platforms.includes(mainPlatform)
    } else {
      return platforms.includes(departure.platform)
    }
  })
}

async function getScheduledArrivals(knownArrivals, db) {
  let timetables = db.getCollection('timetables')
  let today = utils.getPTDayName(utils.now())
  let minutesPastMidnight = utils.getMinutesPastMidnightNow()

  let arrivals = await timetables.findDocuments({
    operationDays: today,
    mode: 'regional train',
    direction: 'Up',
    runID: {
      $not: {
        $in: knownArrivals
      }
    },
    stopTimings: {
      $elemMatch: {
        stopName: 'Southern Cross Railway Station',
        arrivalTimeMinutes: {
          $gt: minutesPastMidnight
        }
      }
    }
  }).toArray()

  return arrivals.map(a => {
    let platform = a.stopTimings.slice(-1)[0].platform
    let {arrivalTimeMinutes} = a.stopTimings.slice(-1)[0]
    let arrivalTime = utils.minutesAftMidnightToMoment(arrivalTimeMinutes, utils.now())

    return {
      type: 'vline',
      scheduled: true,
      shortRouteName: a.shortRouteName,
      trip: a,
      platform,
      destinationArrivalTime: arrivalTime,
      estimatedDepartureTime: null,
      runID: a.runID,
      vehicle: null,
      origin: a.origin.slice(0, -16),
      destination: a.destination.slice(0, -16)
    }
  })
}

function shortenName(name) {
  if (name === 'South Kensington') return 'S Kensington'
  if (name === 'North Williamstown') return 'N Williamstwn'
  if (name === 'Williamstown Beach') return 'Wilmstwn Bch'
  if (name === 'South Kensington') return 'S Kensington'
  if (name.includes('Flemington')) return name.replace('Flemington', 'Flemtn')
  return name
}

function getStoppingPattern(routeName, stopsAt, isUp, type) {
  if (routeName === 'Bendigo') {
    if (!isUp && stopsAt.slice(-1)[0] === 'Eaglehawk') routeName = 'Swan Hill'
  }

  let lineStops = getLineStops(routeName)
  if (isUp) lineStops = lineStops.slice(0).reverse()

  lineStops = TrainUtils.getFixedLineStops(stopsAt, lineStops, routeName, isUp, type)
  let expresses = TrainUtils.findExpressStops(stopsAt, lineStops, routeName, isUp, 'Southern Cross')
  if (expresses.length === 0) return 'STOPPING ALL STATIONS'
  if (expresses.length === 1 && expresses[0].length == 1) return `NOT STOPPING AT ${shortenName(expresses[0][0]).toUpperCase()}`
  let firstExpress = expresses[0]
  let firstExpressStop = firstExpress[0], lastExpressStop = firstExpress.slice(-1)[0]

  let previousStop = shortenName(lineStops[lineStops.indexOf(firstExpressStop) - 1])
  let nextStop = shortenName(lineStops[lineStops.indexOf(lastExpressStop) + 1])
  return `EXPRESS ${previousStop.toUpperCase()} -- ${nextStop.toUpperCase()}`
}

async function appendMetroData(departure, timetables) {
  let {runID} = departure
  let today = utils.getPTDayName(utils.now())

  let scheduled = await timetables.findDocument({
    runID, operationDays: today
  })

  let connections = []

  if (scheduled) connections = scheduled.connections

  let stopTimings = departure.trip.stopTimings.map(e => e.stopName)
  let routeName = departure.trip.routeName
  let isUp = departure.trip.direction === 'Up'

  if (departure.forming) {
    isUp = departure.forming.direction === 'Up'
    routeName = departure.forming.routeName
    let sssIndex = stopTimings.indexOf('Southern Cross')
    stopTimings = stopTimings.slice(sssIndex).concat(departure.forming.stopTimings.map(e => e.stopName))
    stopTimings = stopTimings.filter((e, i, a) => a.indexOf(e) === i)
  }
  stopTimings = stopTimings.map(e => e.slice(0, -16))
  let sssIndex = stopTimings.indexOf('Southern Cross')
  let trimmedTimings = stopTimings.slice(sssIndex)

  let via = []
  trimmedTimings.slice(0, 6).forEach(stop => {
    if (via.length === 2) return

    if (stop === 'Flinders Street') {
      via.push('Flinders St')
    } else if (stop === 'Flagstaff') {
      via.push('City Loop')
    }
    if (stop === 'North Melbourne') {
      via.push('Nth Melbourne')
    } else if (stop === 'Richmond') {
      via.push('Richmond')
    }
  })

  let message = []

  let viaText = `VIA ${via[0].toUpperCase()}`
  if (via[1]) viaText += ` AND ${via[1].toUpperCase()}`

  departure.viaText = viaText
  departure.connections = connections || []

  departure.stoppingPattern = getStoppingPattern(routeName, trimmedTimings, isUp, 'metro')

  return departure
}

async function appendVLineData(departure, timetables) {
  let {runID} = departure
  let today = utils.getPTDayName(utils.now())

  let stopTimings = departure.trip.stopTimings.map(e => e.stopName.slice(0, -16))
  let routeName = departure.shortRouteName
  let isUp = false

  let {destination} = departure

  let viaStops = []
  if (destination === 'South Geelong') viaStops = ['Deer Park', 'Tarneit', 'Wyndham Vale']
  if (destination === 'Geelong') viaStops = ['Deer Park', 'Tarneit']
  if (destination === 'Marshall') viaStops = ['Tarneit', 'Wyndham Vale']
  if (destination === 'Epsom') viaStops = ['Bendigo']
  if (destination === 'Melton') viaStops = ['Deer Park', 'Caroline Springs']
  if (destination === 'Wyndham Vale') viaStops = ['Deer Park', 'Tarneit']
  if (destination === 'Waurn Ponds') viaStops = ['Deer Park', 'Tarneit', 'Wyndham Vale']
  if (destination === 'Wendouree') viaStops = ['Ballarat']
  if (destination === 'Shepparton') viaStops = ['Seymour']

  let via = stopTimings.filter(s => viaStops.includes(s)).map(e => e.toUpperCase())
  let viaStopsText
  if (via.length === 1) viaStopsText = via[0]
  else if (via.length === 2) viaStopsText = `${via[0]} & ${via[1]}`
  else {
    let initial = via.slice(0, -1).join(' - ')
    let last = via.slice(-1)[0]
    return `${initial} & ${last}`
  }

  let viaText = `via ${viaStopsText}`
  let viaWords = viaText.split(' ')

  let brokenVia = ['', '']
  let wordCount = 0
  viaWords.forEach(word => {
    wordCount += word.length
    if (wordCount > 20) {
      brokenVia[1] += ` ${word}`
    } else {
      brokenVia[0] += ` ${word}`
    }
  })

  departure.viaText = viaText
  departure.brokenVia = brokenVia

  departure.stoppingPattern = getStoppingPattern(routeName, stopTimings, isUp, 'vline')

  return departure
}

module.exports = async (platforms, db) => {
  if (departuresCache.get('SSS')) {
    let data = departuresCache.get('SSS')
    return { departures: filterPlatforms(data.departures, platforms), arrivals: filterPlatforms(data.arrivals, platforms) }
  }

  if (apiLock) {
    return await new Promise(resolve => {
      apiLock.on('done', data => {
        resolve({ departures: filterPlatforms(data.departures, platforms), arrivals: filterPlatforms(data.arrivals, platforms) })
      })
    })
  }

  apiLock = new EventEmitter()
  apiLock.setMaxListeners(Infinity)

  let sss = await db.getCollection('stops').findDocument({
    codedName: 'southern-cross-railway-station'
  })

  let vlinePlatform = sss.bays.find(bay => bay.mode === 'regional train')
  let metroPlatform = sss.bays.find(bay => bay.mode === 'metro train')

  let timetables = db.getCollection('timetables')

  let departures = await async.map(await getServicesFromVNET(vlinePlatform, true, db), async d => {
    return await appendVLineData(d, timetables)
  })
  let arrivals = await getServicesFromVNET(vlinePlatform, false, db)
  let knownArrivals = arrivals.map(a => a.runID)

  let scheduledArrivals = await getScheduledArrivals(knownArrivals, db)
  let mtmDepartures = await async.map(await getMetroDepartures(sss, db, 15, true), async d => {
    return await appendMetroData(d, timetables)
  })

  let allArrivals = arrivals.concat(scheduledArrivals).sort((a, b) => a.destinationArrivalTime - b.destinationArrivalTime)

  let allDepartures = departures.concat(mtmDepartures)
  let rawData = { departures: allDepartures, arrivals: allArrivals }
  departuresCache.put('SSS', rawData)

  apiLock.emit('done', rawData)
  apiLock = null

  let data = { departures: filterPlatforms(allDepartures, platforms), arrivals: filterPlatforms(allArrivals, platforms) }

  return data
}
