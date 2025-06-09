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

  routeNameCache[routeName] = route
  routeIDCache[route.routeGTFSID] = route

  return route
}

async function getBaseStopUpdateData(db, stop) {
  let stopData = await getStopByName(db, stop.stopName)
  let platformBay
  if (stop.platform) {
    platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.platform === stop.platform)
  } else {
    platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.stopType == 'station')
  }

  let updatedData = {
    stopGTFSID: platformBay.parentStopGTFSID || platformBay.stopGTFSID,
    stopNumber: null,
    suburb: platformBay.suburb
  }

  return {
    stopData, platformBay, updatedData
  }
}

export async function updateTrip(db, trip, { skipWrite, skipStopCancellation } = { skipWrite: false, skipStopCancellation: false }) {
  let dbTrip = await getTrip(db, trip.runID, trip.operationDays)
  let liveTimetables = db.getCollection('live timetables')

  if (!dbTrip) return await createTrip(db, trip)
  let timetable = LiveTimetable.fromDatabase(dbTrip)

  timetable.cancelled = trip.cancelled
  if (trip.cancelled) {
    if (!skipWrite) await liveTimetables.replaceDocument(timetable.getDBKey(), timetable.toDatabase())
    return timetable
  }

  if (trip.forming) timetable.forming = trip.forming
  if (trip.formedBy) timetable.formedBy = trip.formedBy

  let existingStops = timetable.getStopNames()

  let stopVisits = {}
  for (let stop of trip.stops) {
    let { stopData, updatedData } = await getBaseStopUpdateData(db, stop)

    if (!stopVisits[stop.stopName]) stopVisits[stop.stopName] = 0
    stopVisits[stop.stopName]++

    if (!existingStops.includes(stop.stopName)) updatedData.additional = true
    if (stop.platform) updatedData.platform = stop.platform
    if (typeof stop.cancelled !== 'undefined') updatedData.cancelled = stop.cancelled
    else updatedData.cancelled = false

    if (stop.scheduledDepartureTime) updatedData.scheduledDepartureTime = stop.scheduledDepartureTime.toISOString()
    if (stop.estimatedDepartureTime) updatedData.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()
    if (stop.estimatedArrivalTime) updatedData.estimatedArrivalTime = stop.estimatedArrivalTime.toISOString()

    timetable.updateStopByName(stopData.stopName, updatedData, { visitNum: stopVisits[stop.stopName] })
  }

  if (!skipStopCancellation) {
    for (let stop of existingStops) {
      if (!stopVisits[stop]) {
        timetable.updateStopByName(stop, {
          cancelled: true
        })
      }
    }
  }

  timetable.sortStops()

  if (!skipWrite) await liveTimetables.replaceDocument(timetable.getDBKey(), timetable.toDatabase())

  return timetable
}

async function createTrip(db, trip) {
  let routeData = await getRoute(db, trip.routeGTFSID)

  let timetable = new LiveTimetable(
    'metro train',
    trip.operationDays,
    routeData.routeName,
    routeData.routeNumber,
    routeData.routeGTFSID,
    null,
    null
  )

  timetable.logChanges = false

  timetable.isRRB = false
  timetable.runID = trip.runID
  timetable.direction = trip.runID[3] % 2 === 0 ? 'Up' : 'Down'

  timetable.forming = trip.forming
  timetable.formedBy = trip.formedBy

  let stopVisits = {}
  for (let stop of trip.stops) {
    let { stopData, updatedData } = await getBaseStopUpdateData(db, stop)

    if (!stopVisits[stop.stopName]) stopVisits[stop.stopName] = 0
    stopVisits[stop.stopName]++

    if (stop.platform) updatedData.platform = stop.platform

    if (stop.scheduledDepartureTime) updatedData.scheduledDepartureTime = stop.scheduledDepartureTime.toISOString()
    else if (stop.estimatedDepartureTime) updatedData.scheduledDepartureTime = stop.estimatedDepartureTime.toISOString()
    else if (stop.estimatedArrivalTime) updatedData.scheduledDepartureTime = stop.estimatedArrivalTime.toISOString()
    else throw new Error('Stop has no scheduled or estimated time')

    if (stop.estimatedDepartureTime) updatedData.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()

    timetable.updateStopByName(stopData.stopName, updatedData, { visitNum: stopVisits[stop.stopName] })
  }

  timetable.stops[0].allowDropoff = false
  timetable.stops[trip.stops.length - 1].allowPickup = false

  let liveTimetables = db.getCollection('live timetables')
  await liveTimetables.createDocument(timetable.toDatabase())

  return timetable
}