import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()

const gtfsTimetables = await database.getCollection('gtfs-gtfs timetables')

const depots = [ 22 ]

const missingRoutes = [
  '4-693', '4-695', '4-696',
  '4-697', '4-732'
]

const missingWeekdayDates = [
  '20260223', '20260224', '20260225', '20260226', '20260227',
  '20260302', '20260303', '20260304', '20260305', '20260306'
]

const missingSaturdayDates = [
  '20260228', '20260307'
]

const missingSundayDates = [
  '20260301', '20260308'
]

const refWeekday = '20260323'
const refSaturday = '20260328'
const refSunday = '20260329'

async function expandDay(refDay, missingDays) {
  const trips = await gtfsTimetables.findDocuments({
    mode: 'bus',
    routeGTFSID: { $in: missingRoutes },
    operationDays: refDay,
    depotID: { $in: depots }
  }).toArray()

  await gtfsTimetables.bulkWrite(trips.map(trip => ({
    updateOne: {
      filter: { _id: trip._id },
      update: {
        $unset: { calendarID: '' },
        $set: {
          operationDays: [...new Set(trip.operationDays.concat(missingDays))],
          gtfsReferenceOnly: true
        }
      }
    }
  })))
}

await expandDay(refWeekday, missingWeekdayDates)
await expandDay(refSaturday, missingSaturdayDates)
await expandDay(refSunday, missingSundayDates)

process.exit(0)