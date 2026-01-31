import getStoppingPatternData from './get-stopping-pattern.mjs'
import metroConsists from '../../additional-data/metro-tracker/metro-consists.json' with { type: 'json' }
import { parseConsistFromMotors } from './fleet-parser.mjs'
import async from 'async'

export default async function getTripUpdateData(db, stop, ptvAPI, { skipTDN = [], maxResults = 5, backwards = false } = {}) {
  let liveTimetables = await db.getCollection('live timetables')
  let metroBay = stop.bays.find(bay => bay.mode === 'metro train' && bay.platform)

  let departures = await ptvAPI.metro.getDepartures(metroBay.stopGTFSID, {
    gtfs: true,
    maxResults,
    expand: ['VehicleDescriptor', 'VehiclePosition'],
    backwards,
    includeCancelled: true
  })

  if (!departures) return null

  let tripUpdates = {}

  let trains = departures.filter(dep => !dep.runData.isRailBus && dep.runData.tdn)
  let updatedTrips = trains.filter(dep => dep.runData.updated)
  let regularTrips = trains.filter(dep => !dep.runData.updated)

  await async.forEachLimit(updatedTrips, 7, async departure => {
    if (skipTDN.includes(departure.runData.tdn)) return
    tripUpdates[departure.runData.tdn] = {
      type: 'pattern',
      data: await getStoppingPatternData(departure.runData.tdn, ptvAPI)
    }
  })

  await async.forEachLimit(regularTrips, 7, async departure => {
    let timetable = await liveTimetables.findDocument({
      mode: 'metro train',
      runID: departure.runData.tdn,
      stopTimings: {
        $elemMatch: {
          stopGTFSID: metroBay.parentStopGTFSID,
          scheduledDepartureTime: departure.scheduledDeparture.toUTC().toISO()
        }
      }
    })

    // If a trip had an update but was reverted, PTV reports it as scheduled and not updated
    // But if we have records of an update, this should still count as an updated trip and trigger a pattern update
    const timetableHasUpdate = !!timetable && timetable.changes && timetable.changes.some(c => c.type === 'stop-cancelled')
    if (timetable && !timetableHasUpdate) {
      const tripData = {
        operationDays: timetable.operationDays,
        runID: departure.runData.tdn,
        routeGTFSID: timetable.routeGTFSID,
        stops: [{
          stopName: stop.stopName,
          platform: departure.platform
        }],
        cancelled: departure.runData.cancelled,
      }

      if (departure.runData.additional) tripData.additional = departure.runData.additional
      if (departure.estimatedDeparture) tripData.stops[0].estimatedDepartureTime = new Date(departure.estimatedDeparture.toUTC().toISO())
      if (departure.runData.formedBy) tripData.formedBy = departure.runData.formedBy.tdn
      if (departure.runData.forming) tripData.forming = departure.runData.forming.tdn
      if (departure.runData.vehicle) {
        tripData.consist = parseConsistFromMotors(departure.runData.vehicle.motorCars, metroConsists)
      }

      tripUpdates[departure.runData.tdn] = {
        type: 'stop', data: tripData
      }
    } else {
      tripUpdates[departure.runData.tdn] = {
        type: 'pattern',
        data: await getStoppingPatternData(departure.runData.tdn, ptvAPI)
      }
    }
  })

  return Object.values(tripUpdates)
}