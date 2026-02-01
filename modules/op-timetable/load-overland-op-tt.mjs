import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'
import convertToLive from '../departures/sch-to-live.mjs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import discordIntegration from '../discord-integration.mjs'
import { hostname } from 'os'

const { TRANSIT_MODES } = GTFS_CONSTANTS

async function loadOperationalTT(db, operationDay) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let rawActiveTrips = await gtfsTimetables.findDocuments({
    mode: TRANSIT_MODES.regionalTrain,
    routeGTFSID: /^10-/,
    operationDays: opDayFormat
  }).toArray()

  console.log('Fetched', rawActiveTrips.length, 'trips to process')

  let bulkUpdate = rawActiveTrips.map(trip => convertToLive(trip, operationDay)).map(trip => {
    const sss = trip.stopTimings.find(stop => stop.stopName === 'Southern Cross Railway Station')
    const nsh = trip.stopTimings.find(stop => stop.stopName === 'North Shore Railway Station')
    const art = trip.stopTimings.find(stop => stop.stopName === 'Ararat Railway Station')
    if (sss) sss.platform = '2B'
    if (nsh) nsh.platform = '3'
    if (art) art.platform = '1'

    return trip
  }).map(trip => ({
    replaceOne: {
      filter: { mode: trip.mode, operationDays: trip.operationDays, runID: trip.runID },
      replacement: trip,
      upsert: true
    }
  }))

  if (bulkUpdate.length) {
    await liveTimetables.bulkWrite(bulkUpdate)
  }
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `Overland Op TT: ${hostname()} loading`)

  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await loadOperationalTT(mongoDB, utils.now())
  await loadOperationalTT(mongoDB, utils.now().add(1, 'day'))

  await discordIntegration('taskLogging', `Overland Op TT: ${hostname()} completed loading`)

  await mongoDB.close()
}