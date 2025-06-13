import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import { updateTrip } from '../../metro-trains/trip-updater.mjs'
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import getTripUpdateData from '../../metro-trains/get-stopping-pattern.js'
import { fetchTrips } from './metro-ptv-departures.mjs'

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
    .reduce((acc, e) => acc.concat(e))
}

export async function getStationsOnRoute(db, routeName) {
  return (await db.getCollection('routes').findDocument({
    mode: 'metro train',
    routeName
  })).directions[0].stops.map(stop => stop.stopName).filter(stop => !CBD_EXCLUDE.includes(stop))
}

export async function fetchTripsFromAffectedStops(db, ptvAPI) {
  let affectedLines = await getActiveSuspensions(db)
  let stopsToUse = []

  for (let line of affectedLines) {
    let lineStops = await getStationsOnRoute(db, line)
    shuffleArray(lineStops)

    let offset = 0
    for (let i = 0; i < 5;) {
      let stop = lineStops[i + offset]
      if (stopsToUse.includes(stop)) offset++
      else {
        stopsToUse.push(stop)
        i++
      }
    }
  }

  let tdnsSeen = []
  for (let stop of stopsToUse) {
    tdnsSeen.push(...await fetchTrips(db, ptvAPI, { stationName: stop, skipTDN: tdnsSeen, maxResults: 5 }))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await fetchTripsFromAffectedStops(mongoDB, ptvAPI)

  process.exit(0)
}