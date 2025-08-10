import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

const { TRANSIT_MODES } = GTFS_CONSTANTS

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let gtfsTimetables = mongoDB.getCollection('gtfs timetables')
let liveTimetables = mongoDB.getCollection('live timetables')

let A_CHAR = 'A'.charCodeAt(0)

async function loadOperationalTT(operationDay) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let rawActiveTrips = await gtfsTimetables.findDocuments({
    mode: TRANSIT_MODES.regionalCoach,
    operationDays: opDayFormat
  }).sort({ departureTime: 1, destinationArrivalTime: 1 }).toArray()

  console.log('Fetched', rawActiveTrips.length, 'trips to process')

  let rrbTrips = rawActiveTrips.filter(trip => trip.isRailReplacementBus)
  let schTrips = rawActiveTrips.filter(trip => !trip.isRailReplacementBus)

  let rrbGroupings = rrbTrips.reduce((acc, trip) => {
    if (!acc[trip.railRunID]) acc[trip.railRunID] = []
    acc[trip.railRunID].push(trip)
    return acc
  }, {})

  for (let railRunID of Object.keys(rrbGroupings)) {
    if (rrbGroupings[railRunID].length === 1) {
      rrbGroupings[railRunID][0].runID = `${railRunID}C`
    } else {
      for (let i = 0; i < rrbGroupings[railRunID].length; i++) {
        rrbGroupings[railRunID][i].runID = `${railRunID}${String.fromCharCode(A_CHAR + i)}`
      }
    }
  }

  schTrips.forEach(trip => trip.runID = trip.runID ? `V${trip.runID}` : trip.tripID)

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

await loadOperationalTT(utils.now())
await loadOperationalTT(utils.now().add(1, 'day'))

await mongoDB.close()