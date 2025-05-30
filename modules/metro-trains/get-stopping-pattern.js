const async = require('async')
const utils = require('../../utils')
const config = require('../../config')
const ptvAPI = require('../../ptv-api')
const findConsist = require('./fleet-parser')
const metroTypes = require('../../additional-data/metro-tracker/metro-types')
const addStonyPointData = require('./add-stony-point-data')
const fixTripDestination = require('./fix-trip-destinations')
const routeGTFSIDs = require('../../additional-data/metro-route-gtfs-ids')
const mergeConsist = require('./merge-consist')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']
let cityStations = [...cityLoopStations, 'Flinders Street']
let borderStops = ['Richmond', 'Jolimont', 'North Melbourne', 'Flinders Street']
let liveTrackingRoutes = [
  'Mernda', 'Hurstbridge',
  'Alamein', 'Lilydale', 'Belgrave', 'Glen Waverley',
  'Craigieburn', 'Sunbury', 'Upfield'
]

function extendMetroEstimation(stopTimings) {
  let hasLiveData = false

  let stopData = stopTimings.map(stop => {
    let delay = null
    let scheduledTime = utils.parseTime(stop.scheduledDepartureTime)

    if (stop.estimatedDepartureTime) {
      let estimatedTime = utils.parseTime(stop.estimatedDepartureTime)
      delay = estimatedTime.diff(scheduledTime)
      hasLiveData = true
    }

    return {
      stop,
      delay,
      scheduledTime
    }
  })

  if (hasLiveData) {
    stopData.forEach((stop, i) => {
      if (stop.delay === null && i > 0) {
        let previousStop = stopData[i - 1]
        stop.delay = previousStop.delay // Copy over delay

        let estimatedTime = stop.scheduledTime.add(stop.delay)
        stop.stop.estimatedDepartureTime = estimatedTime.toISOString()
        stop.stop.actualDepartureTimeMS = +estimatedTime
      }
    })
  }
}

async function saveAndUpdateConsist(trip, departureDay, consist, metroTrips) {
  if (!departureDay) return global.loggers.error.err('No date on trip', partialTrip)

  return await mergeConsist(trip, trip.runID, departureDay, consist, metroTrips)
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
  let { ptvRunID, time } = data
  let givenRouteName = data.routeName

  let stopsCollection = db.getCollection('stops')
  let liveTimetables = db.getCollection('live timetables')
  let routesCollection = db.getCollection('routes')
  let metroTrips = db.getCollection('metro trips')
  let metroNotify = db.getCollection('metro notify')
  let metroLocations = db.getCollection('metro locations')

  let url = `/v3/pattern/run/${ptvRunID}/route_type/0?expand=stop&expand=Run&expand=Route&expand=Direction&expand=VehicleDescriptor&expand=VehiclePosition`

  if (time) {
    let startTime = utils.parseTime(time)
    let actualDepartureDay = utils.getYYYYMMDD(startTime)
    let now = utils.now()
    let dayToday = utils.getYYYYMMDDNow()
    let tripStartMinutes = utils.getMinutesPastMidnight(startTime)
    let minutesPastMidnightNow = utils.getMinutesPastMidnight(now)

    if (tripStartMinutes < 180) { // trip starts in the 3am overlap, we want it from the 'previous' day
      // if (givenRouteName && liveTrackingRoutes.includes(givenRouteName)) {
      //   url += `&date_utc=${time}`
      // } else {
        url += `&date_utc=${startTime.add(-4, 'hours').toISOString()}`
      // }
    } else if (minutesPastMidnightNow < 180) { // trip starts before the 3am overlap but it is currently 1-3am. hence requesting for previous day's times
      if (actualDepartureDay === dayToday) { // Its past 3am (next transport day)
        url += `&date_utc=${time}`
      } else { // Its yesterday
        url += `&date_utc=${now.add(-4, 'hours').toISOString()}`
      }
    } else { // sane trip, request with time now
      url += `&date_utc=${startTime.toISOString()}`
    }
  }

  let {departures, stops, runs, routes, directions} = await ptvAPI(url)
  let run = Object.values(runs)[0]
  let ptvDirection = Object.values(directions)[0]
  let routeData = Object.values(routes)[0]

  if (departures.length === 0) return null

  let location = run.vehicle_position
  let dbStops = {}

  let routeName = routeData.route_name
  if (routeName.includes('Flemington')) routeName = 'Flemington Racecourse'
  if (routeData.route_id === 99) routeName = 'City Circle'

  let routeGTFSID = routeGTFSIDs[routeName]
  let route = await routesCollection.findDocument({ routeGTFSID })

  await async.forEachSeries(Object.values(stops), async stop => {
    let stopName = stop.stop_name

    if (stopName === 'Jolimont-MCG') stopName = 'Jolimont'
    if (stopName === 'Glenhuntly') stopName = 'Glen Huntly'
    if (stopName === 'St Albans') stopName = 'St. Albans'
    stopName += ' Railway Station'

    let dbStop = await stopsCollection.findDocument({
      stopName,
      'bays.mode': 'metro train'
    })

    if (!dbStop) global.loggers.general.err('Failed to match stop', stopName)
    dbStops[stop.stop_id] = dbStop
  })

  let previousDepartureTime = -1

  let stopTimings = departures.map(departure => {
    let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
    let estimatedDepartureTime = departure.estimated_departure_utc ? utils.parseTime(departure.estimated_departure_utc) : null
    let actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime

    let { stop_id, platform_number } = departure

    let stopBay = dbStops[stop_id].bays.find(bay => bay.mode === 'metro train')
    let stopName = stopBay.fullStopName

    let departureTimeMinutes = utils.getMinutesPastMidnight(scheduledDepartureTime)

    if (departureTimeMinutes < previousDepartureTime) departureTimeMinutes += 1440
    previousDepartureTime = departureTimeMinutes

    if (stopName === 'Flemington Racecourse Railway Station' && platform_number === '4') platform_number = '2' // 4 Road is Platform 2

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

  extendMetroEstimation(stopTimings)

  let vehicleDescriptor = run.vehicle_descriptor
  let directionName = ptvDirection.direction_name
  let gtfsDirection = route.directions.find(dir => dir.directionName === directionName)?.gtfsDirection
  let direction = ptvDirection.direction_name.includes('City') ? 'Up' : 'Down'

  if (routeName === 'Stony Point') direction = ptvDirection.direction_name.includes('Frankston') ? 'Up' : 'Down'
  if (routeName === 'City Circle') direction = 'Down'

  let cancelled = run.status === 'cancelled'

  let runID, consist, vehicle
  let notifyAlerts = []
  if (ptvRunID >= 948000) runID = utils.getRunID(ptvRunID)

  let trueOrigin
  if (direction === 'Up') trueOrigin = stopTimings[0].stopName
  else { // Down
    let fss = stopTimings.find(stop => stop.stopName === 'Flinders Street Railway Station')
    trueOrigin = fss ? fss.stopName : stopTimings[0].stopName
  }

  let originStop = stopTimings.find(stop => stop.stopName === trueOrigin)
  let scheduledDepartureTime = utils.parseTime(originStop.scheduledDepartureTime)
  let originDepartureDay = scheduledDepartureTime.clone()

  let departureDay = utils.getYYYYMMDD(originDepartureDay)
  let departurePTDay = departureDay

  // if first stop is 12-3am push it to previous day
  if ((originStop.departureTimeMinutes % 1440) < 180) {
    stopTimings.forEach(stop => {
      if (stop.arrivalTimeMinutes !== null) stop.arrivalTimeMinutes += 1440
      if (stop.departureTimeMinutes !== null) stop.departureTimeMinutes += 1440
    })
    originDepartureDay.add(-4, 'hours')

    departurePTDay = utils.getYYYYMMDD(originDepartureDay)
  }

  let tripKey = {
    mode: 'metro train',
    operationDays: departurePTDay,
    runID
  }

  let referenceTrip = await liveTimetables.findDocument(tripKey)

  if (vehicleDescriptor) {
    consist = findConsist(vehicleDescriptor.id, runID)
    vehicle = {
      size: vehicleDescriptor.description[0],
      type: vehicleDescriptor.description.slice(6),
      consist: []
    }
  }

  if (referenceTrip && referenceTrip.suspension && config.applyMetroSuspensions) {
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
    let tripStartSeconds = +scheduledDepartureTime / 1000
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

  if (runID && routeGTFSID === '2-RCE') {
    let gtfsTimetables = db.getCollection('gtfs timetables')
    cancelled = stopTimings.length === 1 // RCE trips show SSS only if cancelled

    let originStop = stopTimings[0].stopName
    let originTime = utils.parseTime(stopTimings[0].scheduledDepartureTime)
    let originTimeHHMM = stopTimings[0].departureTime

    let scheduledTrip = await gtfsTimetables.findDocument({
      operationDays: departurePTDay,
      mode: 'metro train',
      routeGTFSID: '2-RCE',
      direction,
      stopTimings: {
        $elemMatch: {
          stopName: originStop,
          ...(direction === 'Down' ? {
            departureTime: originTimeHHMM
          } : {
            arrivalTime: originTimeHHMM
          })
        }
      }
    })

    if (scheduledTrip) {
      let originDepartureMinutes = stopTimings[0].departureTimeMinutes
      let existingStops = stopTimings.map(stop => stop.stopName)
      let missingStops = scheduledTrip.stopTimings.filter(stop => !existingStops.includes(stop.stopName)).map(stop => {
        let minDiff = (stop.departureTimeMinutes || stop.arrivalTimeMinutes) - originDepartureMinutes

        let scheduledTime = originTime.clone().add(minDiff, 'minutes')
        let platform = '1'
        if (stop.stopName === 'North Melbourne Railway Station' && direction === 'Down') {
          platform = '2'
        }

        return {
          ...stop,
          estimatedDepartureTime: null,
          actualDepartureTimeMS: +scheduledTime,
          scheduledDepartureTime: scheduledTime.toISOString(),
          platform,
          stopConditions: { pickup: 0, dropoff: 0 }
        }
      })

      let allStops = stopTimings.concat(missingStops).sort((a, b) => a.actualDepartureTimeMS - b.actualDepartureTimeMS)
      stopTimings = allStops
    }
  }

  let formingData = run.interchange
  let formedBy = referenceTrip?.formedBy || null
  let forming = referenceTrip?.forming || null
  if (formingData && formingData.feeder) formedBy = utils.getRunID(formingData.feeder.run_ref)
  if (formingData && formingData.distributor) forming = utils.getRunID(formingData.distributor.run_ref)

  let timetable
  if (referenceTrip && runID) { // Only update trains as such
    let newStops = stopTimings.map(stop => stop.stopName)
    let existingStops = referenceTrip.stopTimings.map(stop => stop.stopName)

    let newOrigin, newDestination
    let fssName = 'Flinders Street Railway Station'
    if (direction === 'Down') {
      newOrigin = newStops.includes(fssName) ? newStops.indexOf(fssName) : 0
      newDestination = newStops.length - 1
    } else {
      newOrigin = 0
      newDestination = newStops.includes(fssName) ? newStops.indexOf(fssName) : newStops.length - 1
    }

    newStops = newStops.slice(newOrigin, newDestination + 1)

    let existingOrigin = existingStops.includes(referenceTrip.trueOrigin) ? existingStops.indexOf(referenceTrip.trueOrigin) : 0
    let existingDestination = existingStops.includes(referenceTrip.trueDestination) ? existingStops.lastIndexOf(referenceTrip.trueDestination) : existingStops.length - 1
    existingStops = existingStops.slice(existingOrigin, existingDestination + 1)

    let extraStops = newStops.filter(stop => !existingStops.includes(stop))
    let cancelledStops = existingStops.filter(stop => !newStops.includes(stop))
    let extraStopData = stopTimings.filter(stop => extraStops.includes(stop.stopName) && !cityStations.includes(stop.stopName.slice(0, -16)))

    if (cancelledStops.includes('Flinders Street Railway Station')) {
      if (runID && runID[0] === '7' && cancelledStops.length === 1) { // Footy special - add back in FSS for display purposes
        cancelledStops.splice(cancelledStops.indexOf('Flinders Street Railway Station'), 1)
      } else { // FSS cancelled - remove city loop stops too
        cancelledStops.push(...cityLoopStations.map(stop => `${stop} Railway Station`))
      }
    }

    let cityStopsRaw = stopTimings.filter(stop => cityStations.includes(stop.stopName.slice(0, -16)))
    let cityStops = []
    cityStopsRaw.forEach((stop, i) => {
      if (i === 0) return cityStops.push(stop)
      let prev = cityStopsRaw[i - 1]
      if (prev.stopName === stop.stopName) return
      cityStops.push(stop)
    })

    let hasSeenFSS = false
    let otherStops = referenceTrip.stopTimings.filter(stop => {
      let notCity = !cityStations.includes(stop.stopName.slice(0, -16))
      let cancelled = cancelledStops.includes(stop.stopName)

      if (referenceTrip.direction === 'Down') {
        if (stop.stopName === 'Flinders Street Railway Station') hasSeenFSS = true

        if (!hasSeenFSS && cancelled) return false
      }

      return notCity || cancelled
    })

    let mainTripMerged = otherStops.concat(extraStopData).sort((a, b) => (a.departureTimeMinutes || a.arrivalTimeMinutes) - (b.departureTimeMinutes || b.arrivalTimeMinutes))

    let mergedTimings = direction === 'Down' ? [
      ...cityStops, ...mainTripMerged
    ] : [ // Up
      ...mainTripMerged, ...cityStops
    ]

    referenceTrip.stopTimings = mergedTimings.map(stop => {
      if (extraStops.includes(stop.stopName)) {
        stop.additional = true
      }

      stop.cancelled = cancelledStops.includes(stop.stopName)

      let updatedStop = stopTimings.find(newStop => stop.stopName === newStop.stopName && stop.scheduledDepartureTime === newStop.scheduledDepartureTime)
      if (updatedStop) {
        if (updatedStop.estimatedDepartureTime && updatedStop.estimatedDepartureTime !== stop.estimatedDepartureTime) { // Only update if changed and exists
          stop.estimatedDepartureTime = updatedStop.estimatedDepartureTime
          stop.actualDepartureTimeMS = updatedStop.actualDepartureTimeMS
        }

        if (stop.departureTime !== updatedStop.departureTime) {
          stop.arrivalTime = updatedStop.arrivalTime
          stop.arrivalTimeMinutes = updatedStop.arrivalTimeMinutes
          stop.departureTime = updatedStop.departureTime
          stop.departureTimeMinutes = updatedStop.departureTimeMinutes
        }

        stop.platform = updatedStop.platform
      }

      return stop
    })

    let firstStop = referenceTrip.stopTimings[0]
    let lastStop = referenceTrip.stopTimings[referenceTrip.stopTimings.length - 1]

    timetable = fixTripDestination({
      ...referenceTrip,
      origin: firstStop.stopName,
      destination: lastStop.stopName,
      departureTime: firstStop.departureTime,
      destinationArrivalTime: lastStop.arrivalTime,
      cancelled,
      type: 'timings',
      updateTime: new Date(),
      notifyAlerts,
      formedBy,
      forming
    })
  } else {
    let firstStop = stopTimings[0]
    let lastStop = stopTimings[stopTimings.length - 1]

    timetable = fixTripDestination({
      mode: 'metro train',
      routeName,
      routeGTFSID,
      routeNumber: null,
      routeDetails: null,
      runID,
      formedBy,
      forming,
      operationDays: departurePTDay,
      vehicle: null,
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
    })
  }

  if (timetable.routeName === 'Stony Point') {
    timetable = await addStonyPointData(timetable, originDepartureDay, db)
  }

  if (consist) {
    let vehicleType = metroTypes.find(car => consist[0] === car.leadingCar)
    let ptvSize = vehicleDescriptor.description[0]
    let consistSize = consist.length
    let actualSize = Math.max(ptvSize, consistSize)
    vehicle = { size: actualSize, type: vehicleType.type, consist }

    consist = await saveAndUpdateConsist(timetable, departurePTDay, consist, metroTrips)
    if (location && consist) await saveLocation(consist, location, metroLocations)
  }

  timetable.vehicle = vehicle

  if (!runID && !timetable.isRailReplacementBus) {
    global.loggers.error.warn('Metro trip without runID', timetable)
  }

  if (!runID) {
    tripKey = {
      mode: 'metro train',
      operationDays: departurePTDay,
      origin: timetable.origin,
      destination: timetable.destination,
      departureTime: timetable.departureTime,
      destinationArrivalTime: timetable.destinationArrivalTime
    }
  }

  delete timetable._id
  await liveTimetables.replaceDocument(tripKey, timetable, {
    upsert: true
  })

  return timetable
}
