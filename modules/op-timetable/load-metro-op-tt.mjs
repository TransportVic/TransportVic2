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
    mode: TRANSIT_MODES.metroTrain,
    operationDays: opDayFormat,
    routeGTFSID: {
      $ne: '2-RRB'
    }
  }).sort({ departureTime: 1 }).toArray()

  let activeTrips = rawActiveTrips.map(trip => convertToLive(trip, operationDay))

  let blocks = {}
  let trips = {}

  for (let trip of activeTrips) {
    trips[trip.runID] = trip

    trip.operationDays = opDayFormat

    if (trip.block) {
      if (!blocks[trip.block]) blocks[trip.block] = []
      blocks[trip.block].push(trip.runID)
    }

    delete trip._id
  }

  for (let block of Object.values(blocks)) {
    for (let i = 0; i < block.length - 1; i++) {
      let current = block[i]
      let next = block[i + 1]

      trips[current].forming = next
      trips[next].formedBy = current
    }
  }

  let circularTDNs = await liveTimetables.distinct('runID', {
    mode: TRANSIT_MODES.metroTrain,
    operationDays: opDayFormat,
    circular: { $exists: true }
  })

  let bulkUpdate = Object.values(trips).filter(trip => !circularTDNs.includes(trip.runID)).map(trip => ({
    replaceOne: {
      filter: { mode: TRANSIT_MODES.metroTrain, operationDays: trip.operationDays, runID: trip.runID },
      replacement: trip,
      upsert: true
    }
  }))

  await liveTimetables.bulkWrite(bulkUpdate)
}

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await discordIntegration('taskLogging', `Metro Op TT: ${hostname()} loading`)

  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await loadOperationalTT(mongoDB, utils.now())
  await loadOperationalTT(mongoDB, utils.now().add(1, 'day'))

  await discordIntegration('taskLogging', `Metro Op TT: ${hostname()} completed loading`)

  await mongoDB.close()
}