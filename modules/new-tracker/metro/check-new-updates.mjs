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
    if (oldTrip && oldTrip.formedBy === trip.runID) updates.push(oldTrip)
    if (newTrip && newTrip.formedBy !== trip.runID) updates.push(newTrip)
  } else if (change.type === 'formedby-change') {
    if (oldTrip && oldTrip.forming === trip.runID) updates.push(oldTrip)
    if (newTrip && newTrip.forming !== trip.runID) updates.push(newTrip)
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