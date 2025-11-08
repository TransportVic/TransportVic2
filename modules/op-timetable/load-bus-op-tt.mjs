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

const BATCH_SIZE = 1000
async function getBatch(gtfsTimetables, baseQuery, lastSeenID) {
  const query = lastSeenID ? {
    ...baseQuery,
    _id: {
      $gt: lastSeenID
    }
  } : baseQuery

  const trips = await gtfsTimetables.findDocuments(query).sort({ _id: 1 }).limit(BATCH_SIZE).toArray()

  return {
    trips, lastSeenID: trips.length > 0 ? trips[trips.length - 1]._id : null
  }
}

async function loadOperationalTT(db, operationDay) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  const opDayFormat = utils.getYYYYMMDD(operationDay)
  const baseQuery =  {
    mode: TRANSIT_MODES.bus,
    routeGTFSID: /^4-/,
    operationDays: opDayFormat
  }

  let curMaxID = null
  let totalSeen = 0

  do {
    const {
      trips,
      lastSeenID
    } = await getBatch(gtfsTimetables, baseQuery, curMaxID)
    curMaxID = lastSeenID
    if (trips.length === 0) break

    totalSeen += trips.length
    console.log('Fetched', trips.length, 'trips to process')

    let bulkUpdate = trips.map(trip => convertToLive(trip, operationDay)).map(trip => ({
      replaceOne: {
        filter: { mode: trip.mode, operationDays: trip.operationDays, runID: trip.runID },
        replacement: trip,
        upsert: true
      }
    }))

    await liveTimetables.bulkWrite(bulkUpdate)
  } while (curMaxID !== null)

  console.log('Processed', totalSeen, ' trips in total')
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