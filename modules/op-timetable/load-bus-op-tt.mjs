import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import discordIntegration from '../discord-integration.js'
import { hostname } from 'os'

const { TRANSIT_MODES } = GTFS_CONSTANTS

async function loadOperationalTT(db, operationDay) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let rawActiveTrips = await gtfsTimetables.findDocuments({
    mode: TRANSIT_MODES.bus,
    routeGTFSID: /^4-/,
    operationDays: opDayFormat
  }).toArray()

  console.log('Fetched', rawActiveTrips.length, 'trips to process')

  for (let i = 0; i < rawActiveTrips.length / 1000; i++) {
    let start = i * 1000
    let end = (i + 1) * 1000

    // TODO: Implement block data with refactored method
    let activeTrips = rawActiveTrips.slice(start, end).map(trip => convertToLive(trip, operationDay)).map(trip => {
      trip.operationDays = opDayFormat
      trip.runID = trip.tripID

      return trip
    })

    let bulkUpdate = activeTrips.map(trip => ({
      replaceOne: {
        filter: { mode: trip.mode, operationDays: trip.operationDays, runID: trip.runID },
        replacement: trip,
        upsert: true
      }
    }))

    await liveTimetables.bulkWrite(bulkUpdate)
  }
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `Bus Op TT: ${hostname()} loading`)

  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await loadOperationalTT(mongoDB, utils.now())
  await loadOperationalTT(mongoDB, utils.now().add(1, 'day'))

  await discordIntegration('taskLogging', `Bus Op TT: ${hostname()} completed loading`)

  await mongoDB.close()
}