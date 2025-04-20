import { PTVAPI, MetroSiteAPIInterface } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import LiveTimetable from '../schema/live-timetable.js'

export async function getUpcomingTrips(ptvAPI, lines) {
  let trips = await ptvAPI.metroSite.getOperationalTimetable(lines)
  let today = utils.now().startOf('day')

  return trips.filter(trip => trip.operationalDateMoment >= today)
}

async function getStop(db, stopName) {
  let stops = db.getCollection('stops')
  let stop = await stops.findDocument({
    stopName
  })

  return stop
}

async function getRoute(db, routeName) {
  let routes = db.getCollection('routes')
  let route = await routes.findDocument({
    routeName
  })

  return route
}

async function getTrip(liveTimetables, runID, date) {
  return await liveTimetables.findDocument({
    mode: 'metro train',
    runID,
    operationDays: date
  })
}

async function createTrip(trip, db) {
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

export async function fetchTrips(ptvAPI, db, lines=Object.values(ptvAPI.metroSite.lines)) {
  let relevantTrips = await getUpcomingTrips(ptvAPI, lines)
  let liveTimetables = db.getCollection('live timetables')

  let tripObjects = {}

  for (let trip of relevantTrips) {
    let tripData = await getTrip(liveTimetables, trip.tdn, trip.operationalDate)

    if (tripData) tripObjects[trip.tdn] = LiveTimetable.fromDatabase(tripData)
    else tripObjects[trip.tdn] = await createTrip(trip, db)
  }

  for (let trip of relevantTrips) {
    let tripData = tripObjects[trip.tdn]

    if (trip.runData.formedBy) {
      let formedByTDN = trip.runData.formedBy.tdn

      let formedByTripData = tripObjects[formedByTDN]
      if (!formedByTripData) {
        tripObjects[formedByTDN] = (formedByTripData = await getTrip(liveTimetables, formedByTDN, trip.operationalDate))
      }

      if (formedByTripData) formedByTripData.forming = trip.tdn
      tripData.formedBy = formedByTDN
    }

    if (trip.runData.forming) {
      let formingTDN = trip.runData.forming.tdn

      let formingTripData = tripObjects[formingTDN]
      if (!formingTripData) {
        tripObjects[formingTDN] = (formingTripData = await getTrip(liveTimetables, formingTDN, trip.operationalDate))
      }

      if (formingTripData) formingTripData.formedBy = trip.tdn
      tripData.forming = formingTDN
    }
  }

  let bulkUpdate = Object.values(tripObjects).map(trip => ({
    replaceOne: {
      filter: { mode: 'metro train', operationDays: trip.operationDay, runID: trip.runID },
      replacement: trip.toDatabase(),
      upsert: true
    }
  }))

  await liveTimetables.bulkWrite(bulkUpdate)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  await fetchTrips(ptvAPI, null, ptvAPI.metroSite.lines.STONY_POINT)
}