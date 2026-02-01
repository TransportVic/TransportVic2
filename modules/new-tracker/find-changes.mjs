import { fileURLToPath } from 'url'
import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'
import stationCodesMap from '../../additional-data/station-codes.json' with { type: 'json' }
import fs from 'fs/promises'

let codes = Object.keys(stationCodesMap).reduce((acc, e) => {
  acc[stationCodesMap[e]] = e
  return acc
}, {})

async function findChanges(timetables, cutoff) {
  let updatedTrips = await timetables.findDocuments({
    operationDays: utils.getYYYYMMDD(cutoff),
    mode: 'metro train',
    changes: {
      $elemMatch: {
        timestamp: {
          $gt: new Date(cutoff)
        },
        type: {
          $ne: 'veh-change'
        }
      }
    }
  }).toArray()

  return updatedTrips.map(t => t.changes.map(change => ({
    ...change,
    timestamp: new Date(change.timestamp),
    runID: t.runID,
    origin: t.origin.slice(0, -16),
    departureTime: t.departureTime,
    destination: t.destination.slice(0, -16)
  }))).reduce((a, e) => a.concat(e), []).sort((a,b) => a.timestamp - b.timestamp).map(change => {
    let serviceID = `TD${change.runID} ${change.departureTime} ${codes[change.origin]}-${codes[change.destination]} (Updated ${change.timestamp.toLocaleString()})`
    
    if (change.type === 'veh-change') return null
    if ((change.type === 'formedby-change' || change.type === 'forming-change' || change.type === 'platform-change') && !change.oldVal) return null

    if (change.type === 'platform-change') return `${serviceID} platform change @ ${change.stopGTFSID.slice(-3)}: ${change.oldVal} to ${change.newVal}`
    else if (change.type === 'formedby-change') return `${serviceID} transposal, formed by changed: ${change.oldVal} to ${change.newVal}`
    else if (change.type === 'forming-change') return `${serviceID} transposal, forming changed: ${change.oldVal} to ${change.newVal}`
    else if (change.type === 'add-stop') return `${serviceID} extended, added stop ${change.stopGTFSID.slice(-3)}`
    else if (change.type === 'stop-cancelled') return `${serviceID} stop AMEX: ${change.stopGTFSID.slice(-3)}`
    else if (change.type === 'trip-cancelled') return `${serviceID} AMEX`
    else console.log(serviceID, change)
  }).filter(Boolean)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()
  let timetables = await mongoDB.getCollection('live timetables')

  let allChanges = await findChanges(timetables, utils.now().startOf('day'))
  console.log(allChanges.join('\n'))

  let interval = 1000 * 30

  setInterval(async () => {
    let allChanges = await findChanges(timetables, utils.now().add(-interval, 'ms'))
    if (allChanges.length) {
      console.log(allChanges.join('\n'))
    }
  }, interval)
}