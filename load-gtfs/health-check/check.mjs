export async function checkStops(db) {
  let stops = db.getCollection('stops')
  let failures = []

  let metroStations = ['Flinders Street', 'Ringwood', 'Sunshine']
  for (let stopName of metroStations) {
    let dbStop = await stops.findDocument({ stopName: stopName + ' Railway Station' })
    if (!dbStop) {
      failures.push({ stop: stopName, reason: 'missing' })
      continue
    }
    if (!dbStop.bays.find(bay => bay.mode === 'metro train')) {
      failures.push({ stop: stopName, reason: 'missing-bay' })
    }
  }

  let vlineStations = ['Bendigo', 'Southern Cross']
  for (let stopName of vlineStations) {
    let dbStop = await stops.findDocument({ stopName: stopName + ' Railway Station' })
    if (!dbStop) {
      failures.push({ stop: stopName, reason: 'missing' })
      continue
    }
  }

  if (failures.length) {
    return { status: 'fail', failures }
  } else {
    return { status: 'ok' }
  }
}