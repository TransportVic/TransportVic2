import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'
import convertToLive from '../departures/sch-to-live.mjs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { hostname } from 'os'
import _ from '../../init-loggers.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

async function loadOperationalTT(db, operationDay) {
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  const opDayFormat = utils.getYYYYMMDD(operationDay)
  global.loggers.opTT.log('[BUS] Fetching trips for', opDayFormat)

  let totalSeen = 0
  await gtfsTimetables.batchQuery({
    mode: TRANSIT_MODES.bus,
    routeGTFSID: /^4-/,
    operationDays: opDayFormat
  }, 1000, async trips => {
    totalSeen += trips.length
    global.loggers.opTT.log('[BUS] Fetched', trips.length, 'trips to process')

    const bulkUpdate = trips.filter(trip => !trip.gtfsReferenceOnly).map(trip => convertToLive(trip, operationDay)).map(trip => ({
      replaceOne: {
        filter: { mode: trip.mode, operationDays: trip.operationDays, runID: trip.runID },
        replacement: trip,
        upsert: true
      }
    }))

    await liveTimetables.bulkWrite(bulkUpdate)
  })

  global.loggers.opTT.log('[BUS] Processed', totalSeen, 'trips in total for', opDayFormat)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await loadOperationalTT(mongoDB, utils.now())
  await loadOperationalTT(mongoDB, utils.now().add(1, 'day'))

  await mongoDB.close()
}