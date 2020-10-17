const TimedCache = require('../../TimedCache')
const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const moment = require('moment')
const departureUtils = require('../utils/get-train-timetables')
const guessPlatform = require('./guess-scheduled-platforms')
const termini = require('../../additional-data/termini-to-lines')
const getCoachDepartures = require('../regional-coach/get-departures')
const getVNETDepartures = require('./get-vnet-departures')
const handleTripShorted = require('./handle-trip-shorted')
const EventEmitter = require('events')

const departuresCache = new TimedCache(1000 * 60 * 1)

let ptvAPILocks = {}

let gippsland = ['Traralgon', 'Bairnsdale']

async function getDeparturesFromVNET(vlinePlatform, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')

  let vnetDepartures = await getVNETDepartures(vlinePlatform.vnetStationName, 'D', db, 180)
  let journeyCache = {}
  let stopGTFSID = vlinePlatform.stopGTFSID

  let departures = await async.map(vnetDepartures, async departure => {
    let dayOfWeek = utils.getDayName(departure.originDepartureTime)
    let operationDay = utils.getYYYYMMDD(departure.originDepartureTime)

    let nspTrip = await timetables.findDocument({
      operationDays: dayOfWeek,
      runID: departure.runID,
      mode: 'regional train'
    })

    let trip
    let departureTime = departure.originDepartureTime
    let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departureTime)

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
    }

    let platform = departure.platform
    let originalServiceID = departure.originDepartureTime.format('HH:mm') + trip.destination

    await handleTripShorted(trip, departure, nspTrip, liveTimetables, operationDay)

    trip.vehicleType = departure.vehicleType
    trip.vehicle = departure.vehicle.join('-')

    let currentStation = vlinePlatform.fullStopName.slice(0, -16)

    let shortRouteName = getShortRouteName(trip)
    if (currentStation === 'Southern Cross' && (platform === '15' || platform === '16')) {
      let fixed = false
      if (nspTrip) {
        let nspPlatform = nspTrip.stopTimings[0].platform.replace(/[AB]/, '')
        if (nspPlatform === platform) {
          platform = nspTrip.stopTimings[0].platform
          fixed = true
        }
      }

      if (!fixed) {
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
      actualDepartureTime: departure.originDepartureTime,
      runID: departure.runID,
      vehicle: departure.vehicle,
      destination: trip.destination.slice(0, -16),
      flags: {
        barAvailable: departure.barAvailable,
        accessibleTrain: departure.accessibleTrain
      }
    }, currentStation, nspTrip, departure.vehicle)
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
  let minutes = utils.getMinutesPastMidnightFromHHMM(time)

  let validTimes = []
  for (let i = minutes - 5; i <= minutes + 5; i++) {
    validTimes.push(utils.getHHMMFromMinutesPastMidnight(i))
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

async function appendTripData(db, departure, vlinePlatforms) {
  let vlineTrips = db.getCollection('vline trips')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')
  let shortRouteName = departure.trip.routeName

  if (departure.trip.routeGTFSID === '14-XPT') {
    let stopGTFSIDs = vlinePlatforms.map(bay => bay.stopGTFSID)
    let stopTiming = departure.trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))

    let nswPlatform = vlinePlatforms.find(bay => bay.stopGTFSID === stopTiming.stopGTFSID)
    let platformNumber = nswPlatform.originalName.match(/Platform (\d+)/)[1]
    departure.platform = platformNumber
  } else {
    let vlinePlatform = vlinePlatforms.find(bay => bay.stopGTFSID < 140000000)
    let { stopGTFSID } = vlinePlatform

    let dayOfWeek = utils.getDayName(departure.scheduledDepartureTime)
    let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departure.scheduledDepartureTime)

    let departureMoment = departure.scheduledDepartureTime.clone()
    if (scheduledDepartureTimeMinutes < 180) departureMoment.add(-1, 'day')
    let departureDay = utils.getYYYYMMDD(departureMoment)

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

    let stopTiming = departure.trip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)

    if (stopTiming.cancelled) departure.cancelled = true
    if (departure.trip.type === 'change' && departure.trip.modifications.some(m => m.type === 'terminate')) {
      let termination = departure.trip.modifications.find(m => m.type === 'terminate')

      let tripStops = departure.trip.stopTimings.map(stop => stop.stopName.slice(0, -16))
      let currentIndex = tripStops.indexOf(currentStation)
      let terminationIndex = tripStops.indexOf(termination.changePoint)

      departure.cancelled = departure.cancelled || currentIndex >= terminationIndex

      if (currentIndex < terminationIndex) {
        departure.destination = termination.changePoint
      }
    }
  }

  departure.originalServiceID = departure.trip.originalServiceID || departure.scheduledDepartureTime.format('HH:mm') + departure.trip.destination
  departure.flags = {}

  return departure
}

async function getScheduledDepartures(db, station) {
  let vlinePlatforms = station.bays.filter(bay => bay.mode === 'regional train')

  let scheduled = await departureUtils.getScheduledDepartures(station, db, 'regional train', 180)

  return (await async.map(scheduled, async departure => {
    return await appendTripData(db, departure, vlinePlatforms)
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
    ptvAPILocks[cacheKey].emit('done', departures)
    delete ptvAPILocks[cacheKey]

    return departures
  }

  try {
    let flagMap = {}
    let vlinePlatforms = station.bays.filter(bay => bay.mode === 'regional train')
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
        let vicVlinePlatform = vlinePlatforms.find(bay => bay.stopGTFSID < 140000000)
        if (!vicVlinePlatform) return resolve()

        let time = utils.now().add(-6, 'minutes').toISOString()
        ptvDepartures = await ptvAPI(`/v3/departures/route_type/3/stop/${vicVlinePlatform.stopGTFSID}?gtfs=true&max_results=15&expand=run&expand=route&date_utc=${time}`)
      } catch (e) { console.error(e) } finally { resolve() }
    }), new Promise(async resolve => {
      try {
        scheduledCoachReplacements = (await getCoachDepartures(coachStop, db)).filter(departure => {
          return moment.utc(departure.scheduledDepartureTime.diff(utils.now())) < 1000 * 60 * 180
        })
      } catch (e) { console.error(e) } finally { resolve() }
    }), new Promise(async resolve => {
      try {
        if (station.stopName === 'Southern Cross Railway Station') {
          let vicVlinePlatform = vlinePlatforms.find(bay => bay.stopGTFSID < 140000000)
          vnetDepartures = await getDeparturesFromVNET(vicVlinePlatform, db)
        }
      } catch (e) { console.error(e) } finally { resolve() }
    })])

    let scheduled = await getScheduledDepartures(db, station)
    cancelledTrains = scheduled.filter(departure => departure.cancelled)

    try {
      departures = ptvDepartures.departures, runs = ptvDepartures.runs, routes = ptvDepartures.routes
      let now = utils.now()

      departures.forEach(departure => {
        let run = runs[departure.run_ref]
        let departureTime = utils.parseTime(departure.scheduled_departure_utc)
        if (departureTime.diff(now, 'minutes') > 600) return

        let destination = run.destination_name
        let {flags} = departure

        let serviceID = departureTime.format('HH:mm') + destination
        flagMap[serviceID] = findFlagMap(departure.flags)
      })
    } catch (e) {
      console.error(e)
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
      console.error(e)
    }

    function addFlags(departure) {
      let serviceID = departure.originalServiceID
      let flags = flagMap[serviceID]
      if (!flags) return departure

      if (flags.reservationsOnly) departure.flags.reservationsOnly = true
      if (flags.firstClassAvailable) departure.flags.firstClassAvailable = true
      if (flags.barAvailable && !departure.flags.barAvailable) departure.flags.barAvailable = null

      return departure
    }

    if (vnetDepartures.length) {
      try {
        let xptDepartures = scheduled.filter(departure => departure.trip.routeGTFSID === '14-XPT')
        let allDepartures = vnetDepartures.map(addFlags).concat(xptDepartures).concat(coachReplacements)

        let cancelledIDs = cancelledTrains.map(train => train.originalServiceID)
        let nonCancelled = allDepartures.filter(train => !cancelledIDs.includes(train.originalServiceID))

        let sorted = nonCancelled.concat(cancelledTrains).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
        departuresCache.put(cacheKey, sorted)

        return returnDepartures(sorted)
      } catch (e) {
        console.error(e)
      }
    }

    let allDepartures = scheduled.map(addFlags).concat(coachReplacements).sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
    departuresCache.put(cacheKey, allDepartures)

    return returnDepartures(allDepartures)
  } catch (e) {
    console.error(e)
    return returnDepartures(null)
  }
}

module.exports = getDepartures
