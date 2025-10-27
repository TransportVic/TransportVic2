import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips } from './metro-ptv-departures.mjs'
import { getTrips } from './metro-ptv-trips.mjs'
import { updateRelatedTrips } from './check-new-updates.mjs'
import _ from '../../../init-loggers.mjs'
import fs from 'fs/promises'

async function fetchStop(name, db, ptvAPI, maxResults, backwards, tdnsSeen, newlyUpdatedTrips) {
  let updatedTrips = await fetchTrips(db, ptvAPI, { stationName: name, skipTDN: tdnsSeen, maxResults, backwards })
  let newTDNs = updatedTrips.map(trip => trip.runID)
  newlyUpdatedTrips.push(...updatedTrips)
  tdnsSeen.push(...newTDNs)
  return newTDNs
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

const CBD_EXCLUDE = [
  'Flinders Street Railway Station',
  'Southern Cross Railway Station',
  'Flagstaff Railway Station',
  'Melbourne Central Railway Station',
  'Parliament Railway Station',
  'Richmond Railway Station',
  'Jolimont Railway Station',
  'North Melbourne Railway Station',
]

export async function getActiveSuspensions(db) {
  return (await db.getCollection('metro notify').findDocuments({
    type: 'suspended',
    active: true
  }).toArray())
    .map(alert => alert.routeName)
    .reduce((acc, e) => acc.concat(e), [])
}

export async function getStationsOnRoute(db, routeName) {
  return (await db.getCollection('routes').findDocument({
    mode: 'metro train',
    routeName
  })).directions[0].stops.map(stop => stop.stopName).filter(stop => !CBD_EXCLUDE.includes(stop))
}

export async function fetchNotifySuspensions(db, ptvAPI, existingTrips) {
  let affectedLines = await getActiveSuspensions(db)
  let stopsToUse = []

  for (let line of affectedLines) {
    let lineStops = await getStationsOnRoute(db, line)
    shuffleArray(lineStops)

    let offset = 0
    for (let i = 0; i < 3;) {
      let stop = lineStops[i + offset]
      if (stopsToUse.includes(stop)) offset++
      else {
        stopsToUse.push(stop)
        i++
      }
    }
  }

  let updatedTrips = []
  let tdnsSeen = []
  for (let stop of stopsToUse) {
    let newTDNs = []
    newTDNs.push(...await fetchStop(stop, db, ptvAPI, 5, false, tdnsSeen, updatedTrips, existingTrips))
    newTDNs.push(...await fetchStop(stop, db, ptvAPI, 5, true, tdnsSeen, updatedTrips, existingTrips))
    global.loggers.trackers.metro.log('> Notify Suspensions: Updating TDNs: ' + newTDNs.join(', '))

    let station = await db.getCollection('stops').findDocument({
      stopName: stop
    })
    let missingTDNs = (await getTrips(db, ptvAPI, station, tdnsSeen)).map(update => update.runID)
    tdnsSeen.push(...missingTDNs)
    global.loggers.trackers.metro.log('> Notify Suspensions: Updating Missing TDNs: ' + missingTDNs.join(', '))
  }
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchNotifySuspensions(mongoDB, ptvAPI)

  process.exit(0)
}