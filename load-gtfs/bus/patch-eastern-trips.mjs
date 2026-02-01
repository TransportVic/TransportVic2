import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()

const gtfsTimetables = await database.getCollection('gtfs timetables')

const depots = [ 19, 22, 29 ]

const missingRoutes = [
  '4-663', '4-664', '4-670', '4-671',
  '4-672', '4-675', '4-677', '4-679',
  '4-680', '4-682', '4-688', '4-689',
  '4-690', '4-691', '4-693', '4-694',
  '4-695', '4-696', '4-697', '4-699',
  '4-732', '4-735', '4-736', '4-737',
  '4-738', '4-740', '4-742', '4-753',
  '4-754', '4-755', '4-765'
]

const missingWeekdayDates = [
  '20260202', '20260203', '20260204', '20260205', '20260206',
  '20260209', '20260210', '20260211', '20260212', '20260213'
]

const missingSaturdayDates = [
  '20260207', '20260214'
]

const missingSundayDates = [
  '20260207', '20260214'
]

const refWeekday = '20260302'
const refSaturday = '20260314'
const refSunday = '20260315'

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
          operationDays: [...new Set(trip.operationDays.concat(missingDays))]
        }
      }
    }
  })))
}

await expandDay(refWeekday, missingWeekdayDates)
await expandDay(refSaturday, missingSaturdayDates)
await expandDay(refSunday, missingSundayDates)

process.exit(0)