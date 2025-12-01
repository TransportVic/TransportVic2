import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()

const timetables = await database.getCollection('live timetables')
const affectedTrips = (await timetables.findDocuments({
  mode: 'metro train',
  operationDays: '20251201',
  routeGTFSID: {
    $in: ['2-PKM', '2-CBE', '2-SUY']
  },
  'stopTimings.stopName': 'Town Hall Railway Station'
}).toArray()).map(trip => {
  const seen = new Set()
  trip.stopTimings = trip.stopTimings.filter(stop => !seen.has(stop.stopName) && (seen.add(stop.stopName) || true))
  return trip
})

const fixed = affectedTrips.map(trip => {
  const thl = trip.stopTimings.findIndex(stop => stop.stopName === 'Town Hall Railway Station')
  if (trip.direction === 'Up')  {
    trip.stopTimings = trip.stopTimings.slice(0, thl + 1)
  } else {
    trip.stopTimings = trip.stopTimings.slice(thl)
  }

  trip.origin = trip.stopTimings[0].stopName
  trip.destination = trip.stopTimings.slice(-1)[0].stopName

  trip.departureTime = trip.stopTimings[0].departureTime
  trip.destinationArrivalTime = trip.stopTimings.slice(-1)[0].arrivalTime
  return trip
})

for (const trip of fixed) {
  await timetables.replaceDocument({ _id: trip._id }, trip)
}

process.exit(0)