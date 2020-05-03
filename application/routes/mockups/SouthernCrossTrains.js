const TimedCache = require('timed-cache')
const async = require('async')
const urls = require('../../../urls.json')
const utils = require('../../../utils')
const moment = require('moment')
const cheerio = require('cheerio')
const termini = require('../../../additional-data/termini-to-lines')
const getMetroDepartures = require('../../../modules/metro-trains/get-departures')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 1.5 })

const EventEmitter = require('events')

let apiLock = null

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
        upsert: isD
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
      }
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

  let departures = await getServicesFromVNET(vlinePlatform, true, db)
  let arrivals = await getServicesFromVNET(vlinePlatform, false, db)
  let knownArrivals = arrivals.map(a => a.runID)

  let scheduledArrivals = await getScheduledArrivals(knownArrivals, db)
  let mtmDepartures = await getMetroDepartures(sss, db, 15, true)

  let allArrivals = arrivals.concat(scheduledArrivals).sort((a, b) => a.destinationArrivalTime - b.destinationArrivalTime)

  let allDepartures = departures.concat(mtmDepartures)
  let rawData = { departures: allDepartures, arrivals: allArrivals }
  departuresCache.put('SSS', rawData)

  apiLock.emit('done', rawData)
  apiLock = null

  let data = { departures: filterPlatforms(allDepartures, platforms), arrivals: filterPlatforms(allArrivals, platforms) }

  return data
}
