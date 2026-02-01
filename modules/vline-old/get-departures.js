const async = require('async')
const utils = require('../../utils.mjs')
const ptvAPI = require('../../ptv-api.mjs')
const departureUtils = require('../utils/get-train-timetables')
const guessPlatform = require('./guess-scheduled-platforms')
const termini = require('../../additional-data/termini-to-lines')
const getCoachDepartures = require('../regional-coach/get-departures-old.js')
const getVNETDepartures = require('./get-vnet-departures')
const handleTripShorted = require('./handle-trip-shorted')
const findTrip = require('./find-trip')
const { getDayOfWeek } = require('../../public-holidays.mjs')

let gippsland = ['Traralgon', 'Bairnsdale']

async function getDeparturesFromVNET(vlinePlatform, db) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let timetables = db.getCollection('timetables')
  let liveTimetables = db.getCollection('live timetables')

  let vnetDepartures = await getVNETDepartures(vlinePlatform.vnetStationName, 'B', db, 180)
  let stopGTFSID = vlinePlatform.stopGTFSID

  let departures = await async.map(vnetDepartures, async departure => {
    let departureTime = departure.originDepartureTime
    let operationDay = utils.getYYYYMMDD(departureTime)
    let departureHHMM = utils.formatHHMM(departureTime)
    let dayOfWeek = await getDayOfWeek(departureTime)

    let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(departureTime)
    if (scheduledDepartureTimeMinutes < 180) {
      let previousDay = departureTime.clone().add(-1, 'day')
      operationDay = utils.getYYYYMMDD(previousDay)
      dayOfWeek = await getDayOfWeek(previousDay)
    }

    let nspTrip = await timetables.findDocument({
      operationDays: dayOfWeek,
      runID: departure.runID,
      mode: 'regional train'
    })

    let trip = await liveTimetables.findDocument({
      operationDays: operationDay,
      runID: departure.runID,
      mode: 'regional train'
    }) || await findTrip(db.getCollection('gtfs timetables'), operationDay, departure.origin, departure.destination, departureHHMM)

    if (!trip) {
      return global.loggers.general.err('Failed to match V/Line departure', departure, departureTime.format('HH:mm'))
    }

    let platform = departure.platform
    let originalServiceID = departureTime.format('HH:mm') + trip.destination

    await handleTripShorted(trip, departure, nspTrip, liveTimetables, operationDay)

    trip.vehicleType = departure.vehicleType
    trip.vehicle = departure.vehicle.join('-')

    let currentStation = vlinePlatform.fullStopName.slice(0, -16)

    let shortRouteName = getShortRouteName(trip)
    if (currentStation === 'Southern Cross' && (platform === '15' || platform === '16')) {
      let fixed = false
      if (nspTrip) {
        let nspPlatform = nspTrip.stopTimings[0].platform
        if (nspPlatform) {
          let basePlatform = nspPlatform.replace(/[AB]/, '')
          if (basePlatform === platform) {
            platform = nspPlatform
            fixed = true
          }
        } else global.loggers.general.warn('No SSS platform data for trip', departure.runID, nspTrip.destination, nspTrip.departureTime)
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
      vehicle: [],
      // vehicle: departure.vehicle,
      destination: departure.destination.slice(0, -16),
      flags: {
        cateringAvailable: departure.cateringAvailable,
        accessibleTrain: departure.accessibleTrain
      }
    }, currentStation, nspTrip, [])
    // }, currentStation, nspTrip, departure.vehicle)
  })

  return departures.filter(Boolean)
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
    map.cateringAvailable = true
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
  if (nspTrip && nspTrip.flags && nspTrip.flags.tripDivides && (vehicle[1] || '').startsWith('VL')) { // Ensure that there is actually something to split
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
      departure.divideMessage = `(Take ${remaining} for ${stopsRange})`
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

  let stopGTFSIDs = vlinePlatforms.map(bay => bay.stopGTFSID)
  let stopTiming = departure.trip.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))

  if (departure.trip.routeGTFSID === '14-XPT') {
    let nswPlatform = vlinePlatforms.find(bay => bay.stopGTFSID === stopTiming.stopGTFSID)
    let platformNumber = nswPlatform.originalName.match(/Platform (\d+)/)[1]
    departure.platform = platformNumber

    if (departure.trip.consist) departure.vehicle = departure.trip.consist.join('-')
  } else {
    let vlinePlatform = vlinePlatforms.find(bay => bay.stopGTFSID < 140000000)
    let { stopGTFSID } = vlinePlatform

    let originStop = departure.trip.stopTimings[0]

    let timingDifference = stopTiming.departureTimeMinutes - originStop.departureTimeMinutes
    let originDepartureTime = departure.scheduledDepartureTime.clone().add(-timingDifference, 'minutes')
    let scheduledDepartureTimeMinutes = utils.getMinutesPastMidnight(originDepartureTime)

    let departureMoment = originDepartureTime.clone()
    if (scheduledDepartureTimeMinutes < 180) departureMoment.add(-1, 'day')

    let operationDay = utils.getYYYYMMDD(departureMoment)
    let dayOfWeek = await getDayOfWeek(departureMoment)

    let {direction, origin, destination, departureTime, destinationArrivalTime} = departure.trip
    let realRouteGTFSID = departure.trip.routeGTFSID

    let nspTrip = await timetables.findDocument({
      origin, destination, direction, routeGTFSID: realRouteGTFSID,
      operationDays: dayOfWeek,
      mode: 'regional train',
      departureTime
    })

    let platform = departure.platform
    if (platform === '??') platform = null

    if (nspTrip && !platform) {
      let nspStopTiming = nspTrip.stopTimings.find(stop => stop.stopGTFSID === stopGTFSID)
      if (nspStopTiming) platform = nspStopTiming.platform
    }

    if (platform && platform.endsWith('N')) {
      platform = platform.slice(0, 1) + 'A'
    }

    let trackerDepartureTime = giveVariance(departureTime)
    let trackerDestinationArrivalTime = giveVariance(destinationArrivalTime)

    let tripData = await vlineTrips.findDocument({
      date: operationDay,
      departureTime: trackerDepartureTime,
      origin: origin.slice(0, -16),
      destination: destination.slice(0, -16)
    })

    if (!tripData) {
      if (direction === 'Up') {
        tripData = await vlineTrips.findDocument({
          date: operationDay,
          departureTime: trackerDepartureTime,
          origin: origin.slice(0, -16)
        })
      } else {
        tripData = await vlineTrips.findDocument({
          date: operationDay,
          destinationArrivalTime: trackerDestinationArrivalTime,
          destination: destination.slice(0, -16)
        })
      }
    }

    if (!tripData && nspTrip) {
      tripData = await vlineTrips.findDocument({
        date: operationDay,
        runID: nspTrip.runID
      })
    }

    let currentStation = vlinePlatform.fullStopName.slice(0, -16)

    if (tripData) {
      tripData.consist = ['']
      let first = tripData.consist[0]
      if (first && first.startsWith('N')) {
        departure.vehicle = tripData.consist.join('-')
      } else {
        departure = checkDivide(departure, currentStation, nspTrip, tripData.consist)
      }
    }

    if (!platform)
      platform = guessPlatform(currentStation, scheduledDepartureTimeMinutes,
        shortRouteName, direction)

    if (!platform) platform = '??'

    departure.shortRouteName = shortRouteName
    departure.platform = platform.toString()

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

  departure.originalServiceID = departure.scheduledDepartureTime.format('HH:mm') + departure.trip.destination
  departure.flags = {}

  return departure
}

async function getScheduledDepartures(db, station) {
  let vlinePlatforms = station.bays.filter(bay => bay.mode === 'regional train')

  let scheduled = await departureUtils.getScheduledDepartures(station, db, 'regional train', 180)

  return (await async.map(scheduled, async departure => {
    return await appendTripData(db, departure, vlinePlatforms)
  })).filter(Boolean).filter(departure => {
    let origin = departure.trip.origin.slice(0, -16)
    let destination = departure.trip.destination.slice(0, -16)
    return !((origin === 'Werribee' && destination === 'Southern Cross') || (origin === 'Southern Cross' && destination === 'Werribee'))
  })
}

function findUpcomingStops(departure, stopGTFSIDs) {
  let tripStops = departure.trip.stopTimings.filter(stop => stop.stopConditions.dropoff === 0 || stopGTFSIDs.includes(stop.stopGTFSID))

  let currentIndex = tripStops.findIndex(stop => stopGTFSIDs.includes(stop.stopGTFSID))
  let stopNames = tripStops.map(stop => stop.stopName.slice(0, -16))
  let futureStops = stopNames.slice(currentIndex + 1)

  departure.allStops = stopNames
  departure.futureStops = futureStops
  departure.takingPassengers = tripStops[currentIndex].stopConditions.pickup === 0
}

async function getDepartures(station, db) {
  try {
    return await utils.getData('vline-departures', station.stopName, async () => {
      let flagMap = {}
      let vlinePlatforms = station.bays.filter(bay => bay.mode === 'regional train')
      let stopGTFSIDs = station.bays.map(bay => bay.stopGTFSID)
      let departures = [], runs, routes
      let coachReplacements = []

      let coachStop = station
      if (station.stopName === 'Southern Cross Railway Station') {
        coachStop = await db.getCollection('stops').findDocument({
          stopName: 'Southern Cross Coach Terminal/Spencer Street'
        })

        stopGTFSIDs.push(...coachStop.bays.map(bay => bay.stopGTFSID))
      }

      let ptvDepartures = { departures: [] }, scheduledCoachReplacements = []
      let vnetDepartures = []
      await Promise.all([new Promise(async resolve => {
        try {
          let vicVlinePlatform = vlinePlatforms.find(bay => bay.stopType === 'stop')
          if (!vicVlinePlatform) return resolve()

          let time = utils.now().add(-6, 'minutes').startOf('minute').toISOString()
          // ptvDepartures = await ptvAPI(`/v3/departures/route_type/3/stop/${vicVlinePlatform.stopGTFSID}?gtfs=true&max_results=10&expand=run&expand=route&date_utc=${time}`)
        } catch (e) { global.loggers.general.err('Failed to get V/Line PTV departures', e) } finally { resolve() }
      }), new Promise(async resolve => {
        try {
          scheduledCoachReplacements = (await getCoachDepartures(coachStop, db)).filter(departure => {
            return departure.scheduledDepartureTime.diff(utils.now(), 'seconds') < 60 * 180
          })
        } catch (e) { global.loggers.general.err('Failed to get V/Line Coach departures', e) } finally { resolve() }
      }), new Promise(async resolve => {
        try {
          if (station.stopName === 'Southern Cross Railway Station') {
            let vicVlinePlatform = vlinePlatforms.find(bay => bay.stopType === 'station')
            vnetDepartures = await getDeparturesFromVNET(vicVlinePlatform, db)
          }
        } catch (e) { global.loggers.general.err('Failed to get V/Line VNET departures', e) } finally { resolve() }
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
        global.loggers.general.err('Failed to process scheduled V/Line PTV departures', e)
      }

      try {
        coachReplacements = JSON.parse(JSON.stringify(scheduledCoachReplacements))
          .filter(coach => coach.isRailReplacementBus)
          .map(coach => {
            coach.scheduledDepartureTime = utils.parseTime(coach.scheduledDepartureTime)
            coach.actualDepartureTime = utils.parseTime(coach.actualDepartureTime)

            coach.shortRouteName = coach.shortRouteName || getShortRouteName(coach.trip)

            if (coach.trip.destination !== 'Southern Cross Coach Terminal/Spencer Street') {
              if (coach.trip.destination.includes('Railway Station')) {
                coach.destination = coach.trip.destination.split('/')[0].slice(0, -16)
              }
            } else coach.destination = 'Southern Cross'
            return coach
          })
      } catch (e) {
        global.loggers.general.err('Failed to process scheduled V/Line coach replacements', e)
      }

      function addFlags(departure) {
        let serviceID = departure.originalServiceID
        let flags = flagMap[serviceID]
        if (!flags) return departure

        departure.flags = flags

        return departure
      }

      if (vnetDepartures.length) {
        try {
          let extraRouteGTFSIDs = ['14-XPT', '10-GSR']
          let nonVlineTrains = scheduled.filter(departure => extraRouteGTFSIDs.includes(departure.trip.routeGTFSID))
          let allDepartures = vnetDepartures.map(addFlags).concat(nonVlineTrains).concat(coachReplacements)

          let cancelledIDs = cancelledTrains.map(train => train.originalServiceID)
          let nonCancelled = allDepartures.filter(train => !cancelledIDs.includes(train.originalServiceID))

          let sorted = nonCancelled.concat(cancelledTrains).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
          sorted.forEach(departure => findUpcomingStops(departure, stopGTFSIDs))

          return sorted
        } catch (e) {
          global.loggers.general.err('Failed to process VNET departures', e)
        }
      }

      let data = scheduled.map(addFlags).concat(coachReplacements).sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
      data.forEach(departure => findUpcomingStops(departure, stopGTFSIDs))

      return data
    })
  } catch (e) {
    global.loggers.general.err('Failed to get V/Line departures', e)
    return null
  }
}

module.exports = getDepartures
