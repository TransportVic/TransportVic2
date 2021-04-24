const async = require('async')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const findConsist = require('./fleet-parser')
const metroTypes = require('../../additional-data/metro-tracker/metro-types')
const addStonyPointData = require('../metro-trains/add-stony-point-data')
const fixTripDestination = require('../metro-trains/fix-trip-destinations')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']
let borderStops = ['Richmond', 'Jolimont', 'North Melbourne', 'Flinders Street']

function extendMetroEstimation(trip) {
  let checkStop

  if (trip.direction === 'Up') {
    let borderStop = trip.stopTimings.find(stop => borderStops.includes(stop.stopName.slice(0, -16)))

    if (borderStop) {
      let hasSeenStop = false
      trip.stopTimings.slice(trip.stopTimings.indexOf(borderStop)).forEach(stop => {
        if (stop.estimatedDepartureTime) checkStop = stop
      })
    }
  }

  if (!checkStop) {
    checkStop = trip.stopTimings[trip.stopTimings.length - 2]
  }

  if (checkStop && checkStop.estimatedDepartureTime) {
    let scheduledDepartureTime = utils.parseTime(checkStop.scheduledDepartureTime)
    let estimatedDepartureTime = utils.parseTime(checkStop.estimatedDepartureTime)
    let delay = estimatedDepartureTime - scheduledDepartureTime

    let hasSeenStop = false
    trip.stopTimings = trip.stopTimings.map(stop => {
      if (hasSeenStop && !stop.estimatedDepartureTime) {
        let stopScheduled = utils.parseTime(stop.scheduledDepartureTime)
        let stopEstimated = stopScheduled.clone().add(delay, 'milliseconds')
        stop.estimatedDepartureTime = stopEstimated.toISOString()
        stop.actualDepartureTimeMS = +stopEstimated
      } else if (stop === checkStop) hasSeenStop = true

      return stop
    })
  }

  // Extend estimation backwards to first stop (usually city loop etc)
  let firstStop = trip.stopTimings[0]
  let secondStop = trip.stopTimings[1]

  if (!firstStop.estimatedDepartureTime && secondStop && secondStop.estimatedDepartureTime) {
    let scheduledDepartureTime = utils.parseTime(firstStop.scheduledDepartureTime)
    let estimatedDepartureTime = utils.parseTime(firstStop.estimatedDepartureTime)
    let delay = estimatedDepartureTime - scheduledDepartureTime

    let secondScheduled = utils.parseTime(secondStop.scheduledDepartureTime)
    let secondEstimated = secondScheduled.clone().add(delay, 'milliseconds')
    secondStop.estimatedDepartureTime = secondEstimated.toISOString()
    secondStop.actualDepartureTimeMS = +secondEstimated
  }

  return trip
}

async function saveConsist(stopTimings, direction, departureDay, runID, consist, metroTrips) {
  let partialTrip = {
    stopTimings,
    direction,
    origin: stopTimings[0].stopName,
    departureTime: stopTimings[0].departureTime,
    destination: stopTimings[stopTimings.length - 1].stopName,
    destinationArrivalTime: stopTimings[stopTimings.length - 1].departureTime
  }

  fixTripDestination(partialTrip)

  let query = {
    date: departureDay,
    runID
  }

  let tripData = {
    ...query,
    origin: partialTrip.trueOrigin.slice(0, -16),
    destination: partialTrip.trueDestination.slice(0, -16),
    departureTime: partialTrip.trueDepartureTime,
    destinationArrivalTime: partialTrip.trueDestinationArrivalTime,
    consist
  }

  let existingTrip
  if (tripData.consist.length === 3) {
    existingTrip = await metroTrips.findDocument(query)
    if (existingTrip) {
      if (existingTrip.consist.length === 6) { // Trip already exists with a filled consist, we only override if a different set matches
        if (!existingTrip.consist.includes(tripData.consist[0])) {
          existingTrip = null
        } // Otherwise do not override a 6 car train with a 3 car
      } else if (existingTrip.consist.length === 3 && !existingTrip.consist.includes(tripData.consist[0])) { // We might have matched half a train and now have the other half, sanity check
        let sanityCheckTrip = await metroTrips.findDocument({
          date: departure.departureDay,
          consist: {
            $and: [ // Match both the one already existing and the one given
              tripData.consist[0],
              existingTrip.consist[0]
            ]
          }
        })

        if (sanityCheckTrip) {
          tripData.consist = sanityCheckTrip.consist
          existingTrip = null
        }
      }
    }
  }

  if (!existingTrip) {
    return tripData.consist
    await metroTrips.replaceDocument(query, tripData, {
      upsert: true
    })
  }
}

async function saveLocation(consist, location, metroLocations) {
  let parts = []
  if (consist.length === 6) {
    parts = [consist.slice(0, 3), consist.slice(3, 6)]
  } else {
    parts = [consist]
  }

  await async.forEach(parts, async train => {
    let locationData = {
      consist: train,
      timestamp: +new Date(),
      location: {
        type: "Point",
        coordinates: [
          location.longitude,
          location.latitude
        ]
      },
      bearing: location.bearing
    }

    await metroLocations.replaceDocument({
      consist: train[0]
    }, locationData, {
      upsert: 1
    })
  })
}

module.exports = async function (data, db) {
  let { ptvRunID, time, referenceTrip } = data

  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')
  let routesCollection = db.getCollection('routes')
  let metroTrips = db.getCollection('metro trips')
  let metroNotify = db.getCollection('metro notify')
  let metroLocations = db.getCollection('metro locations')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/0?expand=stop&expand=Run&expand=Route&expand=Direction&expand=VehicleDescriptor&expand=VehiclePosition`
  if (time) {
    let startTime = utils.parseTime(time)
    let now = utils.now()
    if (utils.getMinutesPastMidnight(startTime) < 180) { // trip starts in the 3am overlap, we want it from the 'previous' day
      url += `&date_utc=${startTime.add(-3.5, 'hours').toISOString()}`
    } else if (utils.getMinutesPastMidnight(now) < 180) { // trip starts before the 3am overlap but it is currently 1-3am. hence requesting for previous day's times
      url += `&date_utc=${now.add(-3.5, 'hours').toISOString()}`
    } else { // sane trip, request with time now
      url += `&date_utc=${now.toISOString()}`
    }
  }

  let {departures, stops, runs, routes, directions} = await ptvAPI(url)
  let run = Object.values(runs)[0]
  let ptvDirection = Object.values(directions)[0]
  let routeData = Object.values(routes)[0]

  let location = run.vehicle_position

  if (departures.length === 0) return referenceTrip

  let dbStops = {}

  let routeGTFSID = routeData.route_gtfs_id
  if (routeData.route_id === 99) routeGTFSID = '2-CCL'
  let route = await routesCollection.findDocument({ routeGTFSID })

  await async.forEachSeries(Object.values(stops), async stop => {
    let stopName = stop.stop_name

    if (stopName === 'Jolimont-MCG') stopName = 'Jolimont'
    if (stopName === 'St Albans') stopName = 'St. Albans'
    stopName += ' Railway Station'

    let dbStop = await stopsCollection.findDocument({
      stopName,
      'bays.mode': 'metro train'
    })

    if (!dbStop) global.loggers.general.err('Failed to match stop', stopName)
    dbStops[stop.stop_id] = dbStop
  })

  let departureDay, departureTime
  let previousDepartureTime = -1

  let stopTimings = departures.map(departure => {
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null
    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

    let { stop_id, platform_number } = departure

    let stopBay = dbStops[stop_id].bays.find(bay => bay.mode === 'metro train')
    let stopName = stopBay.fullStopName

    let departureTimeMinutes = utils.getMinutesPastMidnight(scheduledDepartureTime)

    // if first stop is 12-3am push it to previous day
    if (previousDepartureTime === -1) {
      departureTime = scheduledDepartureTime
      if (departureTimeMinutes < 180) {
        departureTimeMinutes += 1440
        departureDay = utils.getYYYYMMDD(scheduledDepartureTime.clone().add(-3.5, 'hours'))
      } else {
        departureDay = utils.getYYYYMMDD(scheduledDepartureTime)
      }
    }

    if (departureTimeMinutes < previousDepartureTime) departureTimeMinutes += 1440
    previousDepartureTime = departureTimeMinutes

    if (stopName === 'Flemington Racecourse Railway Station' && platform_number === '4') platform_number = '2' // 4 Road is Platform 2
    if (stopName === 'Merinda Park Railway Station' && platform_number === '1') platform_number = '2' // Match physical signage

    return {
      stopName,
      stopNumber: stopBay.stopNumber,
      suburb: stopBay.suburb,
      stopGTFSID: stopBay.stopGTFSID,
      arrivalTime: utils.formatHHMM(scheduledDepartureTime),
      arrivalTimeMinutes: departureTimeMinutes,
      departureTime: utils.formatHHMM(scheduledDepartureTime),
      departureTimeMinutes,
      estimatedDepartureTime: estimatedDepartureTime ? estimatedDepartureTime.toISOString() : null,
      actualDepartureTimeMS: estimatedDepartureTime ? +estimatedDepartureTime : +scheduledDepartureTime,
      scheduledDepartureTime: scheduledDepartureTime.toISOString(),
      platform: platform_number,
      stopConditions: {
        pickup: departure.flags.includes('DOO') ? 1 : 0, // if dropoff only then pickup is unavailable
        dropoff: departure.flags.includes('PUO') ? 1 : 0
      }
    }
  })

  let vehicleDescriptor = run.vehicle_descriptor
  let directionName = ptvDirection.direction_name
  let gtfsDirection = route.ptvDirections[directionName]
  let routeName = route.routeName
  let direction = ptvDirection.direction_name.includes('City') ? 'Up' : 'Down'

  if (routeName === 'Stony Point') direction = ptvDirection.direction_name.includes('Frankston') ? 'Up' : 'Down'
  if (routeName === 'City Circle') direction = 'Down'

  let cancelled = run.status === 'cancelled'

  let runID, consist, vehicle
  let notifyAlerts = []
  if (ptvRunID >= 948000) runID = utils.getRunID(ptvRunID)

  if (vehicleDescriptor) {
    consist = findConsist(vehicleDescriptor.id, runID)
    vehicle = {
      size: vehicleDescriptor.description[0],
      type: vehicleDescriptor.description.slice(6),
      consist: []
    }
  }

  if (consist) {
    let vehicleType = metroTypes.find(car => consist[0] === car.leadingCar)
    let ptvSize = vehicleDescriptor.description[0]
    let consistSize = consist.length
    let actualSize = Math.max(ptvSize, consistSize)
    vehicle = { size: actualSize, type: vehicleType.type, consist }

    consist = await saveConsist(stopTimings, direction, departureDay, runID, consist, metroTrips)
    if (location && consist) await saveLocation(consist, location, metroLocations)
  }

  if (referenceTrip && referenceTrip.suspension) {
    let isDown = direction === 'Down'

    let suspension = referenceTrip.suspension
    let tripStops = stopTimings.map(stop => stop.stopName)

    let startIndex = tripStops.indexOf(suspension.startStation)
    let endIndex = tripStops.indexOf(suspension.endStation)

    // No need to consider current as it would not call getStoppingPattern on it
    if (suspension.disruptionStatus === 'before') { // Cut destination
      let startIndex = tripStops.indexOf(suspension.startStation)
      if (startIndex == -1) startIndex = tripStops.length

      stopTimings = stopTimings.slice(0, startIndex + 1)
      if (runID) runID += isDown ? 'U' : 'D'
    } else if (suspension.disruptionStatus === 'passed') { // Cut origin
      let endIndex = tripStops.indexOf(suspension.endStation)
      if (endIndex == -1) endIndex = 0

      stopTimings = stopTimings.slice(endIndex)
      if (runID) runID += isDown ? 'D' : 'U'
    }
  }

  if (runID) {
    let tripStartSeconds = +departureTime / 1000
    notifyAlerts = await metroNotify.distinct('alertID', {
      fromDate: {
        $gte: tripStartSeconds - 60 * 60
      },
      toDate: {
        $gte: tripStartSeconds
      },
      runID
    })
  }

  let firstStop = stopTimings[0]
  let lastStop = stopTimings[stopTimings.length - 1]

  firstStop.arrivalTime = null
  firstStop.arrivalTimeMinutes = null
  lastStop.departureTime = null
  lastStop.departureTimeMinutes = null

  let routeNumber = referenceTrip ? referenceTrip.routeNumber : route.routeNumber

  let timetable = {
    mode: 'metro train',
    routeName,
    routeGTFSID,
    routeNumber: null,
    routeDetails: null,
    runID,
    operationDays: departureDay,
    vehicle,
    stopTimings: stopTimings,
    origin: firstStop.stopName,
    departureTime: firstStop.departureTime,
    destination: lastStop.stopName,
    destinationArrivalTime: lastStop.arrivalTime,
    type: 'timings',
    updateTime: new Date(),
    gtfsDirection,
    direction,
    cancelled,
    suspensions: referenceTrip ? referenceTrip.suspension : null,
    isRailReplacementBus: departures[0].flags.includes('RRB-RUN'),
    notifyAlerts
  }

  timetable = fixTripDestination(timetable)

  if (timetable.routeName === 'Stony Point') {
    timetable = await addStonyPointData(timetable, tripStartTime, db)
  }

  timetable = extendMetroEstimation(timetable)

  let key = {
    mode: 'metro train',
    operationDays: timetable.operationDays,
    runID
  }

  await liveTimetables.replaceDocument(key, timetable, {
    upsert: true
  })

  return timetable
}
