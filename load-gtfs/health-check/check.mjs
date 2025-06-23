export async function checkStop(stops, stopName, mode) {
 let dbStop = await stops.findDocument({ stopName })
  if (!dbStop) return { stop: stopName, reason: 'missing' }
  if (!dbStop.bays.find(bay => bay.mode === mode)) return { stop: stopName, reason: 'missing-bay' }
}

export async function checkStops(db) {
  let stops = db.getCollection('stops')
  let failures = []

  for (let stopName of ['Flinders Street', 'Ringwood', 'Sunshine']) {
    let fail
    if (fail = await checkStop(stops, stopName + ' Railway Station', 'metro train')) failures.push(fail)
  }

  for (let stopName of ['Southern Cross', 'Bendigo']) {
    let fail
    if (fail = await checkStop(stops, stopName + ' Railway Station', 'regional train')) failures.push(fail)
  }

  if (failures.length) {
    return { status: 'fail', failures }
  } else {
    return { status: 'ok' }
  }
}