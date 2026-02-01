import { updateTDNFromPTV } from './metro-ptv-trips.mjs'
import _ from '../../../init-loggers.mjs'
import utils from '../../../utils.mjs'

async function checkFormingChange(trip, change, liveTimetables, trips, updates) {
  let oldTrip, newTrip
  let tripData = await liveTimetables.findDocument({
    operationDays: trip.operationDay,
    runID: trip.runID
  }, { operationDays: 1, stopTimings: 1 })

  if (change.oldVal) {
    if (trips[change.oldVal]) oldTrip = trips[change.oldVal].toDatabase()
    else oldTrip = await liveTimetables.findDocument({
      operationDays: trip.operationDay,
      runID: change.oldVal
    })
  }

  if (change.newVal) {
    if (trips[change.newVal]) newTrip = trips[change.newVal].toDatabase()
    else newTrip = await liveTimetables.findDocument({
      operationDays: trip.operationDay,
      runID: change.newVal
    })
  }

  if (change.type === 'forming-change') {
    if (oldTrip && oldTrip.formedBy === trip.runID) updates.push({
      operationDays: oldTrip.operationDays,
      departureTime: oldTrip.stopTimings[0].departureTimeMinutes,
      runID: oldTrip.runID,
      setNull: 'formedBy',
      badVal: trip.runID
    })

    if ((!newTrip && change.newVal) || (newTrip && newTrip.formedBy !== trip.runID)) updates.push({
      operationDays: tripData.operationDays,
      departureTime: tripData.stopTimings[0].departureTimeMinutes,
      runID: change.newVal,
      enforceField: 'formedBy',
      enforceValue: trip.runID
    })
  } else if (change.type === 'formedby-change') {
    if (oldTrip && oldTrip.forming === trip.runID) updates.push({ 
      operationDays: oldTrip.operationDays,
      departureTime: oldTrip.stopTimings[0].departureTimeMinutes,
      runID: oldTrip.runID,
      setNull: 'forming',
      badVal: trip.runID
    })
    if ((!newTrip && change.newVal) || (newTrip && newTrip.forming !== trip.runID)) updates.push({
      operationDays: tripData.operationDays,
      departureTime: tripData.stopTimings[0].departureTimeMinutes,
      runID: change.newVal,
      enforceField: 'forming',
      enforceValue: trip.runID
    })
  }
}

export async function getTripsRequiringUpdates(liveTimetables, updatedTrips, excludeTrips = []) {
  let updates = []

  let trips = {}
  for (let trip of updatedTrips) {
    trips[trip.runID] = trip
  }

  for (let trip of updatedTrips) {
    for (let change of trip.newChanges) {
      if (change.type === 'forming-change' || change.type === 'formedby-change') await checkFormingChange(trip, change, liveTimetables, trips, updates) 
    }
  }

  let tdnsSeen = new Set()
  return updates.filter(trip => {
    if (excludeTrips.includes(trip.runID)) return false
    if (tdnsSeen.has(trip.runID)) return false

    tdnsSeen.add(trip.runID)
    return true
  })
}

export async function updateRelatedTrips(db, tripDB, updatedTrips, ptvAPI) {
  let liveTimetables = await db.getCollection('live timetables')
  let tripsNeedingUpdate = []

  // Only consider trips that have a transposal as "seen" to avoid accepting a platform change as proof the transposal is final
  let tdnsSeen = updatedTrips.filter(trip => {
    return trip.newChanges.some(change => change.type === 'forming-change' || change.type === 'formedby-change')
  }).map(trip => trip.runID)

  for (let i = 0; i < 7 && updatedTrips.length; i++) {
    tripsNeedingUpdate = await getTripsRequiringUpdates(liveTimetables, updatedTrips, tdnsSeen)
    let newlyUpdatedTrips = []
    for (let trip of tripsNeedingUpdate) {
      const tripStartTime = utils.parseDate(trip.operationDays).add(trip.departureTimeMinutes, 'minutes')
      let updatedData = await updateTDNFromPTV(db, tripDB, trip.runID, ptvAPI, { date: new Date(tripStartTime.toISOString()) }, 'ptv-pattern-transposal', true)
      if (!updatedData || updatedData.operationDay !== trip.operationDays) continue

      if (trip.setNull && updatedData[trip.setNull] === trip.badVal) updatedData[trip.setNull] = null
      else if (trip.enforceField) updatedData[trip.enforceField] = trip.enforceValue

      await liveTimetables.replaceDocument(updatedData.getDBKey(), updatedData.toDatabase(), {
        upsert: true
      })
      newlyUpdatedTrips.push(updatedData)
    }

    if (newlyUpdatedTrips.length) {
      let updatedTDNs = newlyUpdatedTrips.map(trip => trip.runID)
      global.loggers.trackers.metro.log('> Updated Related TDNs: ' + updatedTDNs.join(', '))
      tdnsSeen.push(...updatedTDNs)
    }
    updatedTrips = newlyUpdatedTrips
  }
}