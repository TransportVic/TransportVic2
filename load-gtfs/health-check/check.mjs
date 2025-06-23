import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }

export async function checkStop(stops, stopName, mode) {
 let dbStop = await stops.findDocument({ stopName })
  if (!dbStop) return { stop: stopName, reason: 'missing' }
  if (!dbStop.bays.find(bay => bay.mode === mode)) return { stop: stopName, reason: 'missing-bay' }
  if (!dbStop.bays.find(bay => bay.mode === mode && bay.services.length && bay.screenServices.length)) return { stop: stopName, reason: 'missing-bay-services' }
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

  for (let stopName of ['Monash University Bus Loop', 'Clifton Hill Interchange/Queens Parade', 'Horsham Town Centre/Roberts Avenue', 'Bairnsdale Hospital/Princes Highway', 'Melbourne Airport T1 Skybus/Arrival Drive']) {
    let fail
    if (fail = await checkStop(stops, stopName, 'bus')) failures.push(fail)
  }

  for (let stopName of ['Melbourne University/Swanston Street', 'Clifton Hill Interchange/Queens Parade', 'Elsternwick Railway Station', 'Footscray Railway Station', 'Bourke Street Mall']) {
    let fail
    if (fail = await checkStop(stops, stopName, 'tram')) failures.push(fail)
  }

  if (failures.length) {
    return { status: 'fail', failures }
  } else {
    return { status: 'ok' }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  console.log(await checkStops(mongoDB))

  process.exit(0)
}