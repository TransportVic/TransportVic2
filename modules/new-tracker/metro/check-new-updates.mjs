import { updateTDNFromPTV } from './metro-ptv-trips.mjs'

async function checkFormingChange(trip, change, liveTimetables, trips, updates) {
  let oldTrip, newTrip

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
    if (oldTrip && oldTrip.formedBy === trip.runID) updates.push({ operationDays: oldTrip.operationDays, runID: oldTrip.runID, setNull: 'formedBy' })
    if (newTrip && newTrip.formedBy !== trip.runID) updates.push({ operationDays: newTrip.operationDays, runID: newTrip.runID})
  } else if (change.type === 'formedby-change') {
    if (oldTrip && oldTrip.forming === trip.runID) updates.push({ operationDays: oldTrip.operationDays, runID: oldTrip.runID, setNull: 'forming'  })
    if (newTrip && newTrip.forming !== trip.runID) updates.push({ operationDays: newTrip.operationDays, runID: newTrip.runID })
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

  return updates.filter(trip => !excludeTrips.includes(trip.runID))
}

export async function updateRelatedTrips(db, updatedTrips, ptvAPI) {
  let liveTimetables = await db.getCollection('live timetables')
  let tripsNeedingUpdate = []

  tripsNeedingUpdate = await getTripsRequiringUpdates(liveTimetables, updatedTrips)
  let newlyUpdatedTrips = []
  for (let trip of tripsNeedingUpdate) {
    let updatedData = await updateTDNFromPTV(db, trip.runID, ptvAPI, {}, 'ptv-pattern-transposal', true)
    if (trip.setNull && updatedData[trip.setNull] !== null) updatedData[trip.setNull] = null
    await liveTimetables.replaceDocument(updatedData.getDBKey(), updatedData.toDatabase())
    newlyUpdatedTrips.push(updatedData)
  }
  if (newlyUpdatedTrips.length) console.log('> Updated Related TDNs: ' + newlyUpdatedTrips.map(trip => trip.runID))
}