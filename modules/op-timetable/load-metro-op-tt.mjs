import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let gtfsTimetables = mongoDB.getCollection('gtfs timetables')
let liveTimetables = mongoDB.getCollection('live timetables')

async function loadOperationalTT(operationDay) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let rawActiveTrips = await gtfsTimetables.findDocuments({
    mode: 'metro train',
    operationDays: opDayFormat
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

  let bulkUpdate = Object.values(trips).map(trip => ({
    replaceOne: {
      filter: { mode: 'metro train', operationDays: trip.operationDays, runID: trip.runID },
      replacement: trip,
      upsert: true
    }
  }))

  await liveTimetables.bulkWrite(bulkUpdate)
}

await loadOperationalTT(utils.now())
await loadOperationalTT(utils.now().add(1, 'day'))

await mongoDB.close()