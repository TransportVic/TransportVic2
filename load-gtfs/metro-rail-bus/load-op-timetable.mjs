import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.js'
import { convertToLive } from '../../modules/departures/sch-to-live.js'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let gtfsTimetables = mongoDB.getCollection('gtfs timetables')
let liveTimetables = mongoDB.getCollection('live timetables')

async function loadOperationalTT(operationDay) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let rawActiveTrips = await gtfsTimetables.findDocuments({
    mode: 'metro train',
    operationDays: opDayFormat,
    routeGTFSID: '2-RRB'
  }).toArray()

  let activeTrips = rawActiveTrips.map(trip => convertToLive(trip, operationDay))

  for (let trip of activeTrips) {
    trip.operationDays = opDayFormat
    delete trip._id
  }

  // Delete all RRB data and use this only if there is actually data
  // Also means that if MTM data drops out but PTV data is still there we don't accidentally delete it
  if (activeTrips.length) {
    await liveTimetables.deleteDocuments({
      mode: 'metro train',
      operationDays: opDayFormat,
      isRailReplacementBus: true
    })
    await liveTimetables.createDocuments(activeTrips)
  }
}

await loadOperationalTT(utils.now())
await loadOperationalTT(utils.now().add(1, 'day'))

await mongoDB.close()