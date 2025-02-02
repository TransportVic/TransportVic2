import { MongoDatabaseConnection } from '@transportme/database'
import { setStopServices, setRouteStops } from '@transportme/load-ptv-gtfs'
import config from '../../config.json' with { type: 'json' }
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let routes = mongoDB.getCollection('routes')
let gtfsTimetables = mongoDB.getCollection('gtfs timetables')

let metroRoutes = await routes.findDocuments({
  mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain
}).toArray()

for (let route of metroRoutes) {
  for (let dir of route.directions) {
    await gtfsTimetables.updateDocuments({
      mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain,
      routeGTFSID: route.routeGTFSID,
      gtfsDirection: dir.gtfsDirection
    }, {
      $set: {
        direction: dir.trainDirection
      }
    })
  }
}

process.exit(0)