import { PTVAPI, MetroSiteAPIInterface } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'
import utils from '../../../utils.mjs'
import { LiveTimetable } from '../../schema/live-timetable.mjs'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import MetroTripUpdater from '../../metro-trains/trip-updater.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'
import discordIntegration from '../../discord-integration.mjs'
import { hostname } from 'os'

export async function getUpcomingTrips(ptvAPI, lines) {
  let trips = await ptvAPI.metroSite.getOperationalTimetable(lines)
  let today = utils.now().startOf('day')

  return trips.filter(trip => trip.operationalDateMoment >= today)
}

export async function fetchTrips(ptvAPI, db, tripDB, lines=Object.values(ptvAPI.metroSite.lines)) {
  let relevantTrips = await getUpcomingTrips(ptvAPI, lines)
  let liveTimetables = db.getCollection('live timetables')

  let tripsByDay = {}
  for (let trip of relevantTrips) {
    if (!tripsByDay[trip.operationDate]) tripsByDay[trip.operationDate] = []
    tripsByDay[trip.operationDate].push(trip)
  }

  for (let dayTrips of Object.values(tripsByDay)) {
    let tripObjects = {}
    for (let trip of dayTrips) {
      let routeData = await MetroTripUpdater.getRouteByName(db, trip.routeName)
      let tripData = {
        operationDays: trip.operationalDate,
        runID: trip.tdn,
        routeGTFSID: routeData.routeGTFSID,
        stops: [],
        cancelled: false
      }
      for (let stop of trip.stops) {
        let tripStop = {
          stopName: stop.stationName + ' Railway Station',
          platform: stop.platform,
          scheduledDepartureTime: new Date(stop.scheduledDeparture.toUTC().toISO()),
          cancelled: false
        }
        tripData.stops.push(tripStop)
      }

      tripObjects[trip.tdn] = await MetroTripUpdater.updateTrip(db, tripDB, tripData, {
        skipWrite: true,
        skipStopCancellation: true,
        dataSource: 'mtm-op-timetable',
        fullTrip: true
      })
    }

    let forming = {}
    let formedBy = {}

    for (let trip of relevantTrips) {
      if (trip.runData.formedBy) {
        let formedByTDN = trip.runData.formedBy.tdn

        formedBy[trip.tdn] = formedByTDN

        let formedByTripData = tripObjects[formedByTDN]
        if (!formedByTripData) {
          formedByTripData = await MetroTripUpdater.getTrip(db, formedByTDN, trip.operationalDate)
          if (formedByTripData) {
            formedByTripData = LiveTimetable.fromDatabase(formedByTripData)
            tripObjects[formedByTDN] = formedByTripData
          }
        }

        if (formedByTripData) {
          let originalForming = formedByTripData.forming
          if (originalForming) {
            let originalFormingData = await MetroTripUpdater.getTrip(db, originalForming, trip.operationalDate)
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
          formingTripData = await MetroTripUpdater.getTrip(db, formingTDN, trip.operationalDate)
          if (formingTripData) {
            formingTripData = LiveTimetable.fromDatabase(formingTripData)
            tripObjects[formingTDN] = formingTripData
          }
        }

        if (formingTripData) {
          let originalFormedBy = formingTripData.formedBy
          if (originalFormedBy) {
            let originalFormedByData = await MetroTripUpdater.getTrip(db, originalFormedBy, trip.operationalDate)
            if (originalFormedByData) {
              tripObjects[originalFormedBy] = LiveTimetable.fromDatabase(originalFormedByData)
              if (!forming[originalFormedBy]) forming[originalFormedBy] = null
            }
          }
        }
      }
    }

    for (let tdn of Object.keys(tripObjects)) tripObjects[tdn].logChanges = false

    for (let tdn of Object.keys(forming)) tripObjects[tdn].forming = forming[tdn]
    for (let tdn of Object.keys(formedBy)) tripObjects[tdn].formedBy = formedBy[tdn]

    let bulkUpdate = Object.values(tripObjects).map(trip => ({
      replaceOne: {
        filter: trip.getDBKey(),
        replacement: trip.toDatabase(),
        upsert: true
      }
    }))

    await liveTimetables.bulkWrite(bulkUpdate)
  }

  return relevantTrips.length
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `Metro Trips Schedule: ${hostname()} loading`)

  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  let tripCount = await fetchTrips(ptvAPI, database, tripDatabase)
  global.loggers.trackers.metro.log('Metro Trips: Updated forming data of', tripCount, 'trips')

  await discordIntegration('taskLogging', `Metro Trips Schedule: ${hostname()} completed loading`)

  process.exit(0)
}