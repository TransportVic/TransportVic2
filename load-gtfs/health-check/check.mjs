export async function checkStops(db) {
  let stops = db.getCollection('stops')
  let failures = []

  let metroStops = ['Flinders Street', 'Ringwood', 'Sunshine']
  for (let stopName of metroStops) {
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