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

  let forming = {}
  let formedBy = {}

  for (let trip of relevantTrips) {
    if (trip.runData.formedBy) {
      let formedByTDN = trip.runData.formedBy.tdn

      formedBy[trip.tdn] = formedByTDN

      let formedByTripData = tripObjects[formedByTDN]
      if (!formedByTripData) {
        formedByTripData = await getTrip(liveTimetables, formedByTDN, trip.operationalDate)
        if (formedByTripData) {
          formedByTripData = LiveTimetable.fromDatabase(formedByTripData)
          tripObjects[formedByTDN] = formedByTripData
        }
      }

      if (formedByTripData) {
        let originalForming = formedByTripData.forming
        if (originalForming) {
          let originalFormingData = await getTrip(liveTimetables, originalForming, trip.operationalDate)
          if (originalFormingData) {
            tripObjects[originalForming] = LiveTimetable.fromDatabase(originalFormingData)
            if (!formedBy[originalForming]) formedBy[originalForming] = null
          }
        }
      }
    }

    if (trip.runData.forming) {
      let formingTDN = trip.runData.forming.tdn

      forming[trip.tdn] = formingTDN

      let formingTripData = tripObjects[formingTDN]
      if (!formingTripData) {
        formingTripData = await getTrip(liveTimetables, formingTDN, trip.operationalDate)
        if (formingTripData) {
          formingTripData = LiveTimetable.fromDatabase(formingTripData)
          tripObjects[formingTDN] = formingTripData
        }
      }

      if (formingTripData) {
        let originalFormedBy = formingTripData.formedBy
        if (originalFormedBy) {
          let originalFormedByData = await getTrip(liveTimetables, originalFormedBy, trip.operationalDate)
          if (originalFormedByData) {
            tripObjects[originalFormedBy] = LiveTimetable.fromDatabase(originalFormedByData)
            if (!forming[originalFormedBy]) forming[originalFormedBy] = null
          }
        }
      }
    }
  }

  for (let tdn of Object.keys(forming)) tripObjects[tdn].forming = forming[tdn]
  for (let tdn of Object.keys(formedBy)) tripObjects[tdn].formedBy = formedBy[tdn]

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