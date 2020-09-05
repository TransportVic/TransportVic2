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
const EventEmitter = require('events')

let ptvAPILocks = {}

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

let gippsland = ['Traralgon', 'Bairnsdale']

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
      estimatedDepartureTime = utils.parseTime($$('ActualArrivalTime').text())
    } // yes arrival cos vnet

    let platform = $$('Platform').text()
    let originDepartureTime = utils.parseTime($$('ScheduledDepartureTime').text())
    let destinationArrivalTime = utils.parseTime($$('ScheduledDestinationArrivalTime').text())
    let runID = $$('ServiceIdentifier').text()
    let originVNETName = $$('Origin').text()
    let destinationVNETName = $$('Destination').text()

    let accessibleTrain = $$('IsAccessibleAvailable').text() === 'true'
    let barAvailable = $$('IsBuffetAvailable').text() === 'true'

    let vehicle = $$('Consist').text().replace(/ /g, '-')
    let vehicleConsist = $$('ConsistVehicles').text().replace(/ /g, '-')
    let fullVehicle = vehicle
    let vehicleType

    if (vehicle.match(/N\d{3}/)) {
      let carriages = vehicleConsist.slice(5).split('-')
      let excludes = ['ACN13', 'FLH32']
      excludes.forEach(exclude => {
        if (carriages.includes(exclude)) {
          carriages.splice(carriages.indexOf(exclude), 1)
        }
      })
      vehicleConsist = vehicleConsist.slice(0, 5) + carriages.join('-')

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

    let trip
    let departureTime = departure.originDepartureTime
    let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departureTime) % 1440

    for (let i = 0; i <= 1; i++) {
      let tripDay = departureTime.clone().add(-i, 'days')
      let query = {
        operationDays: utils.getYYYYMMDD(tripDay),
        mode: 'regional train',
        stopTimings: {
          $elemMatch: {
            stopGTFSID,
            departureTimeMinutes: scheduledDepartureTimeMinutes + 1440 * i
          }
        },
        destination: departure.destination
      }

      // improve this
      trip = await liveTimetables.findDocument(query)
      if (trip) break
      trip = await gtfsTimetables.findDocument(query)
      if (trip) break
    }

    if (!trip && nspTrip) trip = nspTrip

    if (!trip) {
      console.log(departure, departure.originDepartureTime.format('HH:mm'))
      // let originVNETName = departure.originVNETName
      // let destinationVNETName = departure.destinationVNETName
      // trip = await getStoppingPattern(db, originVNETName, destinationVNETName,
      //   departure.originDepartureTime, departure.runID, journeyCache)
    }

    let platform = departure.platform
    let originalServiceID = trip.originalServiceID || departure.originDepartureTime.format('HH:mm') + trip.destination

    if (trip.destination !== departure.destination) {
      let stoppingAt = trip.stopTimings.map(e => e.stopName)
      let destinationIndex = stoppingAt.indexOf(departure.destination)
      let skipping = trip.stopTimings.slice(destinationIndex + 1).map(e => e.stopName)

      trip.stopTimings = trip.stopTimings.slice(0, destinationIndex + 1)
      let lastStop = trip.stopTimings[destinationIndex]

      trip.destination = lastStop.stopName
      trip.destinationArrivalTime = lastStop.arrivalTime
      lastStop.departureTime = null
      lastStop.departureTimeMinutes = null

      trip.skipping = skipping
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

    let currentStation = vlinePlatform.fullStopName.slice(0, -16)

    let shortRouteName = getShortRouteName(trip)
    if (currentStation === 'Southern Cross' && (platform === '15' || platform === '16')) {
      if (nspTrip) {
        let nspPlatform = nspTrip.stopTimings[0].platform.replace(/[AB]/, '')
        if (nspPlatform === platform) platform = nspTrip.stopTimings[0].platform
      } else {
        if (gippsland.includes(shortRouteName)) {
          platform += 'A'
        } else {
          platform += 'B'
        }
      }
    }

    return checkDivide({
      shortRouteName,
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
    }, currentStation, nspTrip, departure.vehicle.split('-'))
  })

  return departures
}

function getShortRouteName(trip) {
  let origin = trip.origin.slice(0, -16)
  let destination = trip.destination.slice(0, -16)
  let originDest = `${origin}-${destination}`

  return termini[originDest] || termini[origin] || termini[destination]
}

function giveVariance(time) {
  let minutes = utils.time24ToMinAftMidnight(time)

  let validTimes = []
  for (let i = minutes - 5; i <= minutes + 5; i++) {
    validTimes.push(utils.minAftMidnightToTime24(i))
  }

  return {
    $in: validTimes
  }
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

let tripDivideTypes = {
  'Bacchus Marsh': 'FRONT',
  'Bendigo': 'FRONT',
  'Ballarat': 'REAR', // Maryborough, Ararat
  'Traralgon': 'REAR', // Sale
  'Geelong': 'REAR' // from WPD, front 3 DV to Depot.
}

function checkDivide(departure, currentStation, nspTrip, consist) {
  let vehicle = consist
  if (nspTrip && nspTrip.flags.tripDivides && (vehicle[1] || '').startsWith('VL')) { // Ensure that there is actually something to split
    let type = tripDivideTypes[nspTrip.flags.tripDividePoint]
    let tripStops = nspTrip.stopTimings.map(stop => stop.stopName.slice(0, -16))
    let remainingStops = tripStops.slice(tripStops.indexOf(nspTrip.flags.tripDividePoint))
    let remaining
    if (type === 'FRONT') remaining = vehicle[1]
    else remaining = vehicle[0]

    if (remainingStops.includes(currentStation)) { // Already past divide point, remove detached vehicle
      vehicle = [remaining]
    } else { // Not yet past, show divide message
      let stopsRange = remainingStops.slice(1).join(', ')
      if (remainingStops.length > 5) {
        stopsRange = `${remainingStops[1]} - ${remainingStops.slice(-1)[0]}`
      }
      departure.divideMessage = `(Take ${remaining} for ${stopsRange} (Experimental, check with staff))`
    }
  }

  departure.vehicle = vehicle.join('-')

  return departure
}

async function appendTripData(db, departure, vlinePlatform) {
  let vlineTrips = db.getCollection('vline trips')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')
  let shortRouteName = getShortRouteName(departure.trip)

  let {stopGTFSID} = vlinePlatform

  let dayOfWeek = utils.getDayName(departure.scheduledDepartureTime)
  let scheduledDepartureTimeMinutes = utils.getPTMinutesPastMidnight(departure.scheduledDepartureTime) % 1440
  let departureDay = departure.scheduledDepartureTime.format('YYYYMMDD')

  let {direction, origin, destination, departureTime, destinationArrivalTime} = departure.trip
  let realRouteGTFSID = departure.trip.routeGTFSID

  let nspTrip = await timetables.findDocument({
    origin, destination, direction, routeGTFSID: realRouteGTFSID,
    operationDays: dayOfWeek,
    mode: 'regional train',
    departureTime
  })

  let platform = departure.platform
  if (platform.endsWith('N')) {
    platform = platform.slice(0, 1) = 'A'
  }
  if (platform === '??') platform = null

  if (nspTrip && !platform) {
    let stopTiming = nspTrip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
    if (stopTiming) platform = stopTiming.platform
  }

  let trackerDepartureTime = giveVariance(departureTime)
  let trackerDestinationArrivalTime = giveVariance(destinationArrivalTime)

  let tripData = await vlineTrips.findDocument({
    date: departureDay,
    departureTime: trackerDepartureTime,
    origin: origin.slice(0, -16),
    destination: destination.slice(0, -16)
  })

  if (!tripData) {
    tripData = await vlineTrips.findDocument({
      date: departureDay,
      departureTime: trackerDepartureTime,
      origin: origin.slice(0, -16)
    })
  }

  if (!tripData) {
    tripData = await vlineTrips.findDocument({
      date: departureDay,
      destination: destination.slice(0, -16),
      destinationArrivalTime: trackerDestinationArrivalTime
    })
  }

  let currentStation = vlinePlatform.fullStopName.slice(0, -16)

  if (tripData) {
    let first = tripData.consist[0]
    if (first.startsWith('N')) {
      departure.vehicle = tripData.consist.join(' ')
    } else {
      departure = checkDivide(departure, currentStation, nspTrip, tripData.consist)
    }
  }

  if (!platform)
    platform = guessPlatform(currentStation, scheduledDepartureTimeMinutes,
      shortRouteName, departure.trip.direction)

  if (!platform) platform = '??'

  departure.shortRouteName = shortRouteName
  departure.platform = platform

  return departure
}

async function getScheduledDepartures(db, station) {
  let vlinePlatform = station.bays.find(bay => bay.mode === 'regional train')

  let scheduled = await departureUtils.getScheduledDepartures(station, db, 'regional train', 180)

  return (await async.map(scheduled, async departure => {
    return await appendTripData(db, departure, vlinePlatform)
  })).filter(Boolean)
}

async function getDepartures(station, db) {
  let cacheKey = station.stopName + 'V'
  if (departuresCache.get(cacheKey)) {
    return departuresCache.get(cacheKey)
  }

  if (ptvAPILocks[cacheKey]) {
    return await new Promise(resolve => {
      ptvAPILocks[cacheKey].on('done', data => {
        resolve(data)
      })
    })
  }

  ptvAPILocks[cacheKey] = new EventEmitter()

  function returnDepartures(departures) {
    departures = departures.filter(departure => {
      return !(departure.skipping && departure.skipping.inclides(station.stopName)) && departure.trip.destination !== station.stopName
    })
    ptvAPILocks[cacheKey].emit('done', departures)
    delete ptvAPILocks[cacheKey]

    return departures
  }

  try {
    let flagMap = {}
    let vlinePlatform = station.bays.find(bay => bay.mode === 'regional train')
    let departures = [], runs, routes
    let coachReplacements = []

    let coachStop = station
    if (station.stopName === 'Southern Cross Railway Station') {
      coachStop = await db.getCollection('stops').findDocument({
        stopName: 'Southern Cross Coach Terminal/Spencer Street'
      })
    }

    let ptvDepartures = [], scheduledCoachReplacements = []
    let vnetDepartures = []
    await Promise.all([new Promise(async resolve => {
      try {
        if (vlinePlatform.stopGTFSID > 100000) return
        ptvDepartures = await ptvAPI(`/v3/departures/route_type/3/stop/${vlinePlatform.stopGTFSID}?gtfs=true&max_results=15&expand=run&expand=route`)
      } catch (e) {} finally { resolve() }
    }), new Promise(async resolve => {
      try {
        scheduledCoachReplacements = (await getCoachDepartures(coachStop, db)).filter(departure => {
          return moment.utc(departure.scheduledDepartureTime.diff(utils.now())) < 1000 * 60 * 180
        })
      } catch (e) {} finally { resolve() }
    }), new Promise(async resolve => {
      try {
        if (station.stopName === 'Southern Cross Railway Station') {
          vnetDepartures = await getDeparturesFromVNET(vlinePlatform, db)
        }
      } catch (e) { console.log(e) } finally { resolve() }
    })])

    let scheduled = await getScheduledDepartures(db, station)
    let xptDepartures = scheduled.filter(d => d.trip.routeGTFSID === '13-XPT')
    cancelledTrains = scheduled.filter(departure => departure.cancelled)

    try {
      departures = ptvDepartures.departures, runs = ptvDepartures.runs, routes = ptvDepartures.routes
      departures.forEach(departure => {
        let run = runs[departure.run_id]
        let departureTime = utils.parseTime(departure.scheduled_departure_utc)
        let destination = run.destination_name
        let {flags} = departure

        let serviceID = departureTime.format('HH:mm') + destination
        flagMap[serviceID] = findFlagMap(departure.flags)
      })
    } catch (e) {
    }

    try {
      coachReplacements = JSON.parse(JSON.stringify(scheduledCoachReplacements))
        .filter(coach => coach.isRailReplacementBus)
        .map(coach => {
          coach.scheduledDepartureTime = utils.parseTime(coach.scheduledDepartureTime)
          coach.actualDepartureTime = utils.parseTime(coach.actualDepartureTime)

          coach.shortRouteName = coach.shortRouteName || getShortRouteName(coach.trip)

          if (coach.trip.destination !== 'Southern Cross Coach Terminal/Spencer Street') {
            if (coach.trip.destination.includes('Railway Station'))
              coach.destination = coach.trip.destination.slice(0, -16)
          } else coach.destination = 'Southern Cross'
          return coach
        })
    } catch (e) {
    }

    if (vnetDepartures.length) {
      try {
        vnetDepartures = vnetDepartures.map(departure => {
          let serviceID = departure.originalServiceID
          let flags = flagMap[serviceID]
          if (!flags) {
            return departure
          }

          if (flags.reservationsOnly) departure.flags.reservationsOnly = true
          if (flags.firstClassAvailable) departure.flags.firstClassAvailable = true
          if (flags.barAvailable && !departure.flags.barAvailable) departure.flags.barAvailable = null

          departure.shortRouteName = getShortRouteName(departure.trip)

          return departure
        })

        let allDepartures = vnetDepartures.concat(xptDepartures).concat(coachReplacements).concat(cancelledTrains).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
        departuresCache.put(cacheKey, allDepartures)

        return returnDepartures(allDepartures)
      } catch (e) {
        console.log(e)
      }
    }

    let allDepartures = scheduled.concat(xptDepartures).concat(coachReplacements).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
    departuresCache.put(cacheKey, allDepartures)

    return returnDepartures(allDepartures)
  } catch (e) {
    console.log(e)
    return returnDepartures(null)
  }
}

module.exports = getDepartures
