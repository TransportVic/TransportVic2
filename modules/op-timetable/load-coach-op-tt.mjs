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
    mode: TRANSIT_MODES.regionalCoach,
    operationDays: opDayFormat
  }).sort({ departureTime: 1, destinationArrivalTime: 1 }).toArray()

  console.log('Fetched', rawActiveTrips.length, 'trips to process')

  rawActiveTrips.filter(trip => !trip.isRailReplacementBus).forEach(trip => trip.runID = trip.runID ? `V${trip.runID}` : trip.tripID)

  let bulkUpdate = Object.values(rawActiveTrips.reduce((acc, trip) => {
    acc[trip.runID] = trip
    return acc
  }, {})).map(trip => convertToLive(trip, operationDay)).map(trip => ({
    replaceOne: {
      filter: { mode: trip.mode, operationDays: trip.operationDays, runID: trip.runID },
      replacement: trip,
      upsert: true
    }
  }))

  await liveTimetables.bulkWrite(bulkUpdate)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `Coach Op TT: ${hostname()} loading`)

  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await loadOperationalTT(mongoDB, utils.now())
  await loadOperationalTT(mongoDB, utils.now().add(1, 'day'))

  await discordIntegration('taskLogging', `Coach Op TT: ${hostname()} completed loading`)

  await mongoDB.close()
}