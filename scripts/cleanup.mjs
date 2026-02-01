import config from '../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import utils from '../utils.mjs'

const RETENTION_PERIODS = {
  notify: 14,
  timetables: 31,
  ...(config.retentionPeriods || {})
}

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect({})
console.log('Retention periods', RETENTION_PERIODS)
console.log('Starting cleanup on', utils.now().toLocaleString())
let metroNotify = database.getCollection('metro notify')
let liveTimetables = database.getCollection('live timetables')

try {
  let startTime = utils.now().add(-RETENTION_PERIODS.notify, 'days') 
  console.log('Cleaning up notify alerts before', startTime)
  let notify = await metroNotify.deleteDocuments({
    toDate: {
      $lte: +startTime / 1000
    }
  })
  console.log('Cleaned up', notify.deletedCount, 'notify alerts')
} catch (e) {
  console.log('Failed to clean up notify data')
}

try {
  let firstTrip = await liveTimetables.findDocuments({})
    .sort({ operationDays: 1 }).limit(1).next()

  let tripsStart = utils.parseDate(firstTrip.operationDays)
  let tripsEnd = utils.now().add(-RETENTION_PERIODS.timetables, 'days')

  if (tripsEnd > tripsStart) {
    console.log('Cleaning up timetables from', tripsStart, 'to', tripsEnd)

    let tripsDay = utils.allDaysBetweenDates(tripsStart, tripsEnd).map(date => utils.getYYYYMMDD(date))

    let liveRemoval = await liveTimetables.deleteDocuments({
      operationDays: {
        $in: tripsDay
      }
    })

    console.log('Cleaned up', liveRemoval.deletedCount, 'live timetables')
  } else {
    console.log('No live timetables to clean up')
  }
} catch (e) {
  console.log('Failed to clean up live trips')
}

await database.close()
process.exit(0)