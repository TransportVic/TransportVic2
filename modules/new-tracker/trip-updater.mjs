import LiveTimetable from '../schema/live-timetable.js'

let stopIDCache = {}
let stopCache = {}

let routeIDCache = {}
let routeNameCache = {}

async function getTrip(db, runID, date) {
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

export async function updateTrip(db, trip) {
  let dbTrip = await getTrip(db, trip.runID, trip.operationDays)
  let tripData

  if (!dbTrip) return await createTrip(db, trip)

  tripData = LiveTimetable.fromDatabase(dbTrip)

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

  timetable.isRRB = false
  timetable.runID = trip.runID
  timetable.direction = trip.runID[3] % 2 === 0 ? 'Up' : 'Down'

  timetable.forming = trip.forming
  timetable.formedBy = trip.formedBy

  for (let stop of trip.stops) {
    let stopData = await getStopByName(db, stop.stopName)
    let platformBay
    if (stop.platform) {
      platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.platform === stop.platform)
    } else {
      // TODO: Change to use parent stop logic
      platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.stopGTFSID.startsWith('vic:rail'))
    }

    let updatedData = {
      stopGTFSID: platformBay.stopGTFSID,
      stopNumber: null,
      suburb: platformBay.suburb
    }

    if (stop.platform) updatedData.platform = stop.platform

    if (stop.scheduledDepartureTime) updatedData.scheduledDepartureTime = stop.scheduledDepartureTime.toISOString()
    else if (stop.estimatedDepartureTime) updatedData.scheduledDepartureTime = stop.estimatedDepartureTime.toISOString()
    else if (stop.estimatedArrivalTime) updatedData.scheduledDepartureTime = stop.estimatedArrivalTime.toISOString()
    else throw new Error('Stop has no scheduled or estimated time')

    if (stop.estimatedDepartureTime) updatedData.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()

    timetable.updateStopByName(stopData.stopName, updatedData)
  }

  timetable.stops[0].allowDropoff = false
  timetable.stops[trip.stops.length - 1].allowPickup = false

  let liveTimetables = db.getCollection('live timetables')
  await liveTimetables.createDocument(timetable.toDatabase())

  return timetable
}