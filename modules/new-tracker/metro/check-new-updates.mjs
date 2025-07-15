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
    if (oldTrip && oldTrip.formedBy === trip.runID) updates.push({ operationDays: oldTrip.operationDays, runID: oldTrip.runID, setNull: 'formedBy', badVal: trip.runID })
    if (newTrip && newTrip.formedBy !== trip.runID) updates.push({ operationDays: newTrip.operationDays, runID: newTrip.runID})
  } else if (change.type === 'formedby-change') {
    if (oldTrip && oldTrip.forming === trip.runID) updates.push({ operationDays: oldTrip.operationDays, runID: oldTrip.runID, setNull: 'forming', badVal: trip.runID  })
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

  let tdnsSeen = new Set()
  return updates.filter(trip => {
    if (excludeTrips.includes(trip.runID)) return false
    if (tdnsSeen.has(trip.runID)) return false

    tdnsSeen.add(trip.runID)
    return true
  })
}

export async function updateRelatedTrips(db, updatedTrips, ptvAPI) {
  let liveTimetables = await db.getCollection('live timetables')
  let tripsNeedingUpdate = []
  let tdnsSeen = updatedTrips.map(trip => trip.runID)

  for (let i = 0; i < 7 && updatedTrips.length; i++) {
    tripsNeedingUpdate = await getTripsRequiringUpdates(liveTimetables, updatedTrips, tdnsSeen)
    let newlyUpdatedTrips = []
    for (let trip of tripsNeedingUpdate) {
      let updatedData = await updateTDNFromPTV(db, trip.runID, ptvAPI, {}, 'ptv-pattern-transposal', true)
      if (trip.setNull && updatedData[trip.setNull] === trip.badVal) updatedData[trip.setNull] = null
      await liveTimetables.replaceDocument(updatedData.getDBKey(), updatedData.toDatabase())
      newlyUpdatedTrips.push(updatedData)
    }

    if (newlyUpdatedTrips.length) {
      let updatedTDNs = newlyUpdatedTrips.map(trip => trip.runID)
      console.log('> Updated Related TDNs: ' + updatedTDNs.join(', '))
      tdnsSeen.push(...updatedTDNs)
    }
    updatedTrips = newlyUpdatedTrips
  }
}