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

  const opDayFormat = utils.getYYYYMMDD(operationDay)

  let totalSeen = 0
  await gtfsTimetables.batchQuery({
    mode: TRANSIT_MODES.regionalTrain,
    $or: [{
      routeName: {
        $in: [
          'Bendigo',
          'Echuca',
          'Swan Hill'
        ]
      },
    }, {
      routeName: 'Albury',
      origin: 'Southern Cross Railway Station', departureTime: '07:07'
    }, {
      routeName: 'Albury',
      origin: 'Albury Railway Station', departureTime: '06:45'
    }],
    operationDays: opDayFormat
  }, 1000, async trips => {
    totalSeen += trips.length
    console.log('Fetched', trips.length, 'trips to process')

    const bulkUpdate = trips.map(trip => convertToLive(trip, operationDay)).map(trip => ({
      replaceOne: {
        filter: { mode: trip.mode, operationDays: trip.operationDays, runID: trip.runID },
        replacement: { ...trip, cancelled: true },
        upsert: true
      }
    }))

    await liveTimetables.bulkWrite(bulkUpdate)
  })

  console.log('Processed', totalSeen, 'trips in total')
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await loadOperationalTT(mongoDB, '20260111')

  await mongoDB.close()
}