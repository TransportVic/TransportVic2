import LiveTimetable from '../schema/live-timetable.js'

let stopIDCache = {}
let stopCache = {}

let routeIDCache = {}
let routeNameCache = {}

export async function getTrip(db, runID, date) {
  let liveTimetables = db.getCollection('live timetables')
  return await liveTimetables.findDocument({
    mode: 'metro train',
    runID,
    operationDays: date
  })
}

export async function getStop(db, stopID) {
  if (stopIDCache[stopID]) return stopCache[stopIDCache[stopID]].bays.find(bay => bay.stopGTFSID == stopID)

  let stops = db.getCollection('stops')
  let stop = await stops.findDocument({
    'bays.stopGTFSID': stopID
  })

  if (!stop) return null

  stopCache[stop.stopName] = stop
  stopIDCache[stopID] = stop.stopName

  return stop.bays.find(bay => bay.stopGTFSID == stopID)
}

export async function getStopByName(db, stopName) {
  if (stopCache[stopName]) return stopCache[stopName]

  let stops = db.getCollection('stops')
  let stop = await stops.findDocument({
    stopName
  })

  if (!stop) return null

  stopCache[stopName] = stop
  return stop
}

export async function getRoute(db, routeGTFSID) {
  if (routeIDCache[routeGTFSID]) return routeIDCache[routeGTFSID]

  let routes = db.getCollection('routes')
  let route = await routes.findDocument({
    mode: 'metro train',
    routeGTFSID
  })

  if (!route) return null

  routeNameCache[routeGTFSID] = route
  routeIDCache[route.routeGTFSID] = route

  return route
}

export async function getRouteByName(db, routeName) {
  if (routeNameCache[routeName]) return routeNameCache[routeName]

  let routes = db.getCollection('routes')
  let route = await routes.findDocument({
    mode: 'metro train',
    routeName
  })

  if (!route) return null

  routeNameCache[routeName] = route
  routeIDCache[route.routeGTFSID] = route

  return route
}

async function getBaseStopUpdateData(db, stop) {
  let stopData = await getStopByName(db, stop.stopName)
  let platformBay
  if (stop.platform) {
    platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.platform === stop.platform)
  }

  if (!platformBay) {
    platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.stopType == 'station')
  }

  if (!platformBay) return {}

  let updatedData = {
    stopGTFSID: platformBay.parentStopGTFSID || platformBay.stopGTFSID,
    stopNumber: null,
    suburb: platformBay.suburb
  }

  return {
    stopData, platformBay, updatedData
  }
}

export async function updateTrackerData(db, timetable) {
  let key = timetable.getTrackerDatabaseKey()
  let metroTrips = db.getCollection('metro trips')
  if (key) await metroTrips.replaceDocument(key, timetable.toTrackerDatabase(), {
    upsert: true
  })
}

export async function updateTrip(db, trip, {
  skipWrite = false,
  skipStopCancellation = false,
  dataSource = 'unknown',
  ignoreMissingStops = [],
  updateTime = null
} = {}) {
  let dbTrip = await getTrip(db, trip.runID, trip.operationDays)
  let liveTimetables = db.getCollection('live timetables')

  if (!dbTrip) {
    let timetable = await createTrip(db, trip, updateTime)
    if (timetable) updateTrackerData(db, timetable)
    return timetable
  }

  let timetable = LiveTimetable.fromDatabase(dbTrip)
  if (updateTime) timetable.lastUpdated = updateTime

  timetable.setModificationSource(dataSource)

  let firstStop = timetable.stops.find(stop => !stop.cancelled)
  if (trip.scheduledStartTime && firstStop.departureTime !== trip.scheduledStartTime) return null

  timetable.cancelled = trip.cancelled
  if (trip.cancelled) {
    if (trip.stops && trip.stops.length) {
      trip.stops.forEach(stop => {
        stop.estimatedDepartureTime = null
        stop.estimatedArrivalTime = null
      })
    } else trip.stops = null
  }

  if (trip.forming) timetable.forming = trip.forming
  if (trip.formedBy) timetable.formedBy = trip.formedBy
  if (trip.consist) timetable.consist = trip.consist.reduce((acc, e) => acc.concat(e), [])
  else if (trip.forcedVehicle) timetable.forcedVehicle = trip.forcedVehicle

  let existingStops = timetable.getStopNames()

  let stopVisits = {}

  if (timetable.direction === 'Up' && trip.stops && trip.stops.length) {
    let updateLastStop = trip.stops[trip.stops.length - 1]
    let isFSS = timetable.destination === 'Flinders Street Railway Station'
    if (isFSS && updateLastStop.stopName === timetable.destination) {
      trip.stops[trip.stops.length - 1].scheduledDepartureTime = null
    }
  }

  let isCCL = trip.routeGTFSID === '2-CCL'
  if (trip.stops) {
    for (let stop of trip.stops) {
      let { stopData, updatedData } = await getBaseStopUpdateData(db, stop)
      if (!stopData) {
        console.log('Failed to update stop ' + JSON.stringify(trip), stop)
        continue
      }

      if (!stopVisits[stop.stopName]) stopVisits[stop.stopName] = 0
      stopVisits[stop.stopName]++

      if (!existingStops.includes(stop.stopName)) updatedData.additional = true
      if (stop.platform) updatedData.platform = stop.platform
      if (typeof stop.cancelled !== 'undefined') updatedData.cancelled = stop.cancelled
      else if (!skipStopCancellation) updatedData.cancelled = false

      if (stop.scheduledDepartureTime) updatedData.scheduledDepartureTime = stop.scheduledDepartureTime.toISOString()
      if (stop.estimatedDepartureTime) updatedData.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()
      if (stop.estimatedArrivalTime) updatedData.estimatedArrivalTime = stop.estimatedArrivalTime.toISOString()

      let matchingCriteria = isCCL ? { prefSchTime: stop.scheduledDepartureTime.toISOString() } : { visitNum: stopVisits[stop.stopName] }
      timetable.updateStopByName(stopData.stopName, updatedData, matchingCriteria)
    }

    if (!skipStopCancellation) {
      for (let stop of existingStops) {
        if (!stopVisits[stop] && !ignoreMissingStops.includes(stop)) {
          timetable.updateStopByName(stop, {
            cancelled: true
          })
        }
      }
    }

    timetable.sortStops()

    let lastNonAMEXStop = timetable.stops.findLastIndex(stop => !stop.cancelled)
    let secondLastStop, lastStop
    if (lastNonAMEXStop > 0) {
      secondLastStop = timetable.stops[lastNonAMEXStop - 1]
      lastStop = timetable.stops[lastNonAMEXStop]
    }

    let lastStopDelay = null
    let lastStopHasETA = trip.stops && trip.stops.length > 1
      && trip.stops[trip.stops.length - 1].stopName === lastNonAMEXStop.stopName
      && (trip.stops[trip.stops.length - 1].estimatedArrivalTime || trip.stops[trip.stops.length - 1].estimatedDepartureTime)

    if (secondLastStop && stopVisits[secondLastStop.stopName] && !lastStopHasETA && secondLastStop.estimatedDepartureTime) {
      let secondLastDelay = secondLastStop.estimatedDepartureTime.diff(secondLastStop.scheduledDepartureTime, 'minutes')
      lastStopDelay = secondLastDelay
    } else if (secondLastStop && secondLastStop.cancelled && !lastStop.cancelled && lastStop.stopName === 'Flinders Street Railway Station') {
      let secondLastStopNonAMEX = timetable.stops.findLast((stop, i) => !stop.cancelled && i < lastNonAMEXStop)
      if (secondLastStopNonAMEX && secondLastStopNonAMEX.stopName === 'Richmond Railway Station') {
        let rmdDelay = secondLastStopNonAMEX.estimatedDepartureTime.diff(secondLastStopNonAMEX.scheduledDepartureTime, 'minutes')
        lastStopDelay = rmdDelay - 10
      } else if (secondLastStopNonAMEX && secondLastStopNonAMEX.stopName === 'North Melbourne Railway Station') {
        let nmeDelay = secondLastStopNonAMEX.estimatedDepartureTime.diff(secondLastStopNonAMEX.scheduledDepartureTime, 'minutes')
        lastStopDelay = nmeDelay - 3
      }
    }

    if (lastStopDelay !== null) {
      let lastStopEstArr = lastStop.scheduledDepartureTime.clone().add(lastStopDelay, 'minutes')
      lastStop.estimatedArrivalTime = lastStopEstArr
      lastStop.estimatedDepartureTime = lastStopEstArr
    }
  }

  if (!skipWrite) await liveTimetables.replaceDocument(timetable.getDBKey(), timetable.toDatabase())
  updateTrackerData(db, timetable)

  return timetable
}

async function createTrip(db, trip, updateTime) {
  let routeData = await getRoute(db, trip.routeGTFSID)

  let timetable = new LiveTimetable(
    'metro train',
    trip.operationDays,
    routeData.routeName,
    routeData.routeNumber,
    routeData.routeGTFSID,
    null,
    null,
    updateTime
  )

  timetable.logChanges = false

  timetable.isRRB = false
  timetable.runID = trip.runID
  timetable.direction = trip.runID[3] % 2 === 0 ? 'Up' : 'Down'

  timetable.forming = trip.forming
  timetable.formedBy = trip.formedBy
  if (trip.consist) timetable.consist = trip.consist.reduce((acc, e) => acc.concat(e), [])
  else if (trip.forcedVehicle) timetable.forcedVehicle = trip.forcedVehicle

  if (!trip.stops || !trip.stops.length) return null

  let isCCL = trip.routeGTFSID === '2-CCL'
  let stopVisits = {}
  for (let stop of trip.stops) {
    let { stopData, updatedData } = await getBaseStopUpdateData(db, stop)

    if (!stopVisits[stop.stopName]) stopVisits[stop.stopName] = 0
    stopVisits[stop.stopName]++

    if (stop.platform) updatedData.platform = stop.platform

    if (stop.scheduledDepartureTime) updatedData.scheduledDepartureTime = stop.scheduledDepartureTime.toISOString()
    else if (stop.estimatedDepartureTime) updatedData.scheduledDepartureTime = stop.estimatedDepartureTime.toISOString()
    else if (stop.estimatedArrivalTime) updatedData.scheduledDepartureTime = stop.estimatedArrivalTime.toISOString()
    else throw new Error('Stop has no scheduled or estimated time ' + JSON.stringify(trip, null, 2))

    if (stop.estimatedDepartureTime) updatedData.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()

    let matchingCriteria = isCCL ? { prefSchTime: stop.scheduledDepartureTime.toISOString() } : { visitNum: stopVisits[stop.stopName] }
    timetable.updateStopByName(stopData.stopName, updatedData, matchingCriteria)
  }

  timetable.sortStops()

  timetable.stops[0].allowDropoff = false
  timetable.stops[trip.stops.length - 1].allowPickup = false

  let liveTimetables = db.getCollection('live timetables')
  await liveTimetables.createDocument(timetable.toDatabase())

  return timetable
}