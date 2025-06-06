import LiveTimetable from '../schema/live-timetable.js'

let stopIDCache = {}
let stopCache = {}

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

async function getStopByName(db, stopName) {
  if (stopCache[stopName]) return stopCache[stopName]

  let stops = db.getCollection('stops')
  let stop = await stops.findDocument({
    stopName
  })

  stopCache[stopName] = stop
  return stop
}

async function getRoute(db, routeName) {
  let routes = db.getCollection('routes')
  let route = await routes.findDocument({
    routeName
  })

  return route
}

export async function updateTrip(db, trip) {
  let dbTrip = await getTrip(db, trip.tdn, trip.operationDays)
  let tripData
  if (!dbTrip) return await createTrip(db, trip)

  tripData = LiveTimetable.fromDatabase(dbTrip)

}

async function createTrip(db, trip) {
  let routeData = await getRoute(db, trip.routeName)

  let timetable = new LiveTimetable(
    'metro train',
    trip.operationalDate,
    trip.routeName,
    routeData.routeNumber,
    routeData.routeGTFSID,
    null,
    null
  )

  timetable.runID = trip.tdn
  timetable.direction = trip.tdn[3] % 2 === 0 ? 'Up' : 'Down'
  timetable.forming = trip.forming
  timetable.formedBy = trip.formedBy

  for (let stop of trip.stops) {
    let stopData = await getStop(db, stop.stationName + ' Railway Station')
    let platformBay = stopData.bays.find(bay => bay.mode === 'metro train' && bay.platform === stop.platform)

    timetable.updateStopByName(stopData.stopName, {
      stopGTFSID: platformBay.stopGTFSID,
      stopNumber: null,
      suburb: platformBay.suburb,
      scheduledDepartureTime: stop.scheduledDeparture.toUTC().toISO(),
      platform: stop.platform
    })
  }

  return timetable
}