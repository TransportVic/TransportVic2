const TimedCache = require('timed-cache')
const async = require('async')
const urls = require('../../urls.json')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 1 })
const moment = require('moment')
const cheerio = require('cheerio')
const departureUtils = require('../utils/get-train-timetables')
const getStoppingPattern = require('../utils/get-vline-stopping-pattern')
const guessPlatform = require('./guess-scheduled-platforms')
const termini = require('../../additional-data/termini-to-lines')
const getCoachDepartures = require('../regional-coach/get-departures')

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

async function getVNETDepartures(vlinePlatform, direction, db) {
  const {vnetStationName} = vlinePlatform

  const body = (await utils.request(urls.vlinePlatformDepartures.format(vnetStationName, direction))).replace(/a:/g, '')
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

async function getDeparturesFromVNET(vlinePlatform, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')

  let vnetDepartures = await getVNETDepartures(vlinePlatform, 'D', db)
  let journeyCache = {}
  let stopGTFSID = vlinePlatform.stopGTFSID

  let departures = await async.map(vnetDepartures, async departure => {
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

    let trip = await db.getCollection('live timetables').findDocument(liveQuery)

    if (!trip) {
      trip = await gtfsTimetables.findDocument({
        origin: departure.origin,
        destination: departure.destination,
        departureTime: utils.formatHHMM(departure.originDepartureTime),
        operationDays: operationDay,
        mode: 'regional train'
      })
    }

    if (!trip && nspTrip) trip = nspTrip

    if (!trip) {
      console.log(departure)
      // let originVNETName = departure.vnetStationName
      // let destinationVNETName = departure.vnetStationName
      // trip = await getStoppingPattern(db, originVNETName, destinationVNETName,
      //   departure.originDepartureTime, departure.runID, journeyCache)
    }

    let platform = departure.platform
    let originalServiceID = trip.originalServiceID || departure.originDepartureTime.format('HH:mm') + trip.destination

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
      trip.originalServiceID = originalServiceID
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
      originalServiceID,
      trip,
      platform,
      scheduledDepartureTime: departure.originDepartureTime,
      runID: departure.runID,
      vehicle: departure.vehicle,
      destination: trip.destination.slice(0, -16),
      flags: {
        barAvailable: departure.barAvailable,
        accessibleTrain: departure.accessibleTrain
      }
    }
  })

  return departures
}

function getShortRouteName(trip) {
  let origin = trip.origin.slice(0, -16)
  let destination = trip.destination.slice(0, -16)
  let originDest = `${origin}-${destination}`

  return termini[originDest] || termini[origin] || termini[destination]
}

async function processPTVDepartures(departures, runs, routes, vlinePlatform, db) {
  let {stopGTFSID, fullStopName} = vlinePlatform

  let stationName = fullStopName.slice(0, -16)

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let trainDepartures = departures.filter(departure => departure.flags.includes('VTR'))

  let mappedDepartures = []
  let now = utils.now()
  let runIDsSeen = []

  await async.forEach(trainDepartures, async trainDeparture => {
    let runID = trainDeparture.run_id
    if (runIDsSeen.includes(runID)) return
    runIDsSeen.push(runID)

    let run = runs[runID]
    let route = routes[trainDeparture.route_id]

    let departureTime = moment.tz(trainDeparture.scheduled_departure_utc, 'Australia/Melbourne')
    let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime) % 1440

    if (departureTime.diff(now, 'minutes') > 180) return

    let routeGTFSID = route.route_gtfs_id
    let destination = utils.adjustStopname(run.destination_name)

    for (let i = 0; i <= 1; i++) {
      let tripDay = now.clone().add(-i, 'days')
      let query = {
        routeGTFSID: routeGTFSID,
        operationDays: tripDay.format('YYYYMMDD'),
        mode: 'regional train',
        stopTimings: {
          $elemMatch: {
            stopGTFSID,
            departureTimeMinutes: scheduledDepartureTimeMinutes + 1440 * i
          }
        },
        destination
      }

      trip = await gtfsTimetables.findDocument(query)
      if (trip) break
    }

    if (!trip) return // Same deal as coach - direction stuff creating non existent trips

    let shortRouteName = getShortRouteName(trip)

    let serviceID = departureTime.format('HH:mm') + destination
    let dayOfWeek = departureTime.day()
    let isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6

    let platform = guessPlatform(stationName, scheduledDepartureTimeMinutes,
      shortRouteName, trip.direction)

    if (platform) platform += '?'
    else platform = '?'

    let departure = {
      shortRouteName,
      serviceID,
      trip,
      platform,
      scheduledDepartureTime: departureTime,
      runID: null,
      vehicle: null,
      destination: trip.destination.slice(0, -16),
      flags: findFlagMap(trainDeparture.flags)
    }

    mappedDepartures.push(departure)
  })

  return mappedDepartures
}

function findFlagMap(flags) {
  let map = {}
  if (flags.includes('RER')) {
    map.reservationsOnly = true
  }
  if (flags.includes('FCA')) {
    map.firstClassAvailable = true
  }
  if (flags.includes('CAA')) {
    map.barAvailable = true
  }
  return map
}

async function getDepartures(station, db) {
  if (departuresCache.get(station.stopName + 'V')) {
    return departuresCache.get(station.stopName + 'V')
  }

  let flagMap = {}
  let vlinePlatform = station.bays.find(bay => bay.mode === 'regional train')
  let departures = [], runs, routes
  try {
    body = await ptvAPI(`/v3/departures/route_type/3/stop/${vlinePlatform.stopGTFSID}?gtfs=true&max_results=5&expand=run&expand=route`)
    departures = body.departures, runs = body.runs, routes = body.routes
    departures.forEach(departure => {
      let run = runs[departure.run_id]
      let departureTime = moment.tz(departure.scheduled_departure_utc, 'Australia/Melbourne')
      let destination = run.destination_name
      let {flags} = departure

      let serviceID = departureTime.format('HH:mm') + destination
      flagMap[serviceID] = findFlagMap(departure.flags)
    })
  } catch (e) {
  }

  let coachReplacements
  let coachStop = station
  if (station.stopName === 'Southern Cross Railway Station') {
    coachStop = await db.getCollection('stops').findDocument({
      stopName: 'Southern Cross Coach Terminal/Spencer Street'
    })
  }

  try {
    coachReplacements = (await getCoachDepartures(coachStop, db))
      .filter(coach => coach.isTrainReplacement)
      .map(coach => {
        coach.shortRouteName = getShortRouteName(coach.trip)

        if (coach.trip.destination !== 'Southern Cross Coach Terminal/Spencer Street')
          coach.destination = coach.trip.destination.slice(0, -16)
        else coach.destination = 'Southern Cross'
        return coach
      })
  } catch (e) {
  }

  if (station.stopName === 'Southern Cross Railway Station') {
    try {
      let vnetDepartures = await getDeparturesFromVNET(vlinePlatform, db)
      vnetDepartures = vnetDepartures.map(departure => {
        let serviceID = departure.originalServiceID
        let flags = flagMap[serviceID]
        if (!flags) console.log(flagMap, serviceID)

        if (flags.reservationsOnly) departure.flags.reservationsOnly = true
        if (flags.firstClassAvailable) departure.flags.firstClassAvailable = true
        if (flags.barAvailable && !departure.flags.barAvailable) departure.flags.barAvailable = null

        departure.shortRouteName = getShortRouteName(departure.trip)

        return departure
      })

      let allDepartures = vnetDepartures.concat(coachReplacements).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
      departuresCache.put(station.stopName + 'V', allDepartures)

      return allDepartures
    } catch (e) {
    }
  }

  if (departures.length) {
    let scheduledTrains = await processPTVDepartures(departures, runs, routes, vlinePlatform, db)

    let allDepartures = scheduledTrains.concat(coachReplacements).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
    departuresCache.put(station.stopName + 'V', allDepartures)

    return allDepartures
  } else {
    let scheduled = await departureUtils.getScheduledDepartures(station, db, 'regional train', 180)
    scheduled = scheduled.map(departure => {
      departure.trip.origin += ' Railway Station'
      departure.trip.destination += ' Railway Station'
      let shortRouteName = getShortRouteName(departure.trip)

      let dayOfWeek = departure.scheduledDepartureTime.day()
      let isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6
      let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departure.scheduledDepartureTime) % 1440

      let platform = guessPlatform(station.stopName.slice(0, -16), scheduledDepartureTimeMinutes,
        shortRouteName, departure.trip.direction)

      if (platform) platform += '?'
      else platform = '?'

      departure.shortRouteName = shortRouteName
      departure.platform = platform

      return departure
    })

    let coachServiceIDs = coachReplacements.map(coach => {
      return coach.scheduledDepartureTime.format('HH:mm') + coach.destination
    })

    scheduled = scheduled.filter(train => {
      let serviceID = train.scheduledDepartureTime.format('HH:mm') + train.destination
      return !coachServiceIDs.includes(serviceID)
    })

    let allDepartures = scheduled.concat(coachReplacements).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
    departuresCache.put(station.stopName + 'V', allDepartures)

    return allDepartures
  }
}

module.exports = getDepartures
