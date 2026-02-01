import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()

const routes = await database.getCollection('routes')
const gtfsTimetables = await database.getCollection('gtfs timetables')

const busRoutes = await routes.distinct('routeGTFSID', { mode: 'bus' })

for (const routeGTFSID of busRoutes) {
  const tomorrow = utils.now().startOf('day').add(1, 'day')
  const tomorrowTrips = await gtfsTimetables.countDocuments({
    mode: 'bus',
    routeGTFSID,
    operationDays: utils.getYYYYMMDD(tomorrow)
  })

  const farTrips = await gtfsTimetables.countDocuments({
    mode: 'bus',
    routeGTFSID,
    operationDays: utils.getYYYYMMDD(tomorrow.clone().add(3, 'weeks'))
  })

  if (Math.abs(tomorrowTrips - farTrips) >= 5) console.log(routeGTFSID, tomorrowTrips, farTrips)
}

process.exit()