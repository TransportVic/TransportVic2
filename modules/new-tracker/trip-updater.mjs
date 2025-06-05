let stopIDCache = {}
let stopCache = {}

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

async function createTrip(trip, db) {
  
}