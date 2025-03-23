import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.js'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let gtfsTimetables = mongoDB.getCollection('gtfs timetables')
let liveTimetables = mongoDB.getCollection('live timetables')

async function loadOperationalTT(operationDay) {
  let activeTrips = await gtfsTimetables.findDocuments({
    mode: 'metro train',
    operationDays: operationDay
  }).sort({ departureTime: 1 }).toArray()

  let blocks = {}
  let trips = {}

  for (let trip of activeTrips) {
    trips[trip.runID] = trip

    trip.operationDays = today

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

let today = utils.getYYYYMMDD(utils.now())
await loadOperationalTT(today)

await mongoDB.close()