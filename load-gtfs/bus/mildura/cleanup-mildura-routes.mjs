import { MongoDatabaseConnection } from '@transportme/database'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import config from '../../../config.json' with { type: 'json' }

import MilduraBusData from '../../../transportvic-data/gtfs/mildura-bus-data.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const dbRoutes = mongoDB.getCollection('gtfs-routes')
const newRoutes = await dbRoutes.countDocuments({
  mode: 'bus',
  routeGTFSID: {
    $in: MilduraBusData.routes.map(r => r.route_id)
  }
})

const oldRoutes = await dbRoutes.countDocuments({
  mode: 'bus',
  routeGTFSID: {
    $in: Object.keys(MilduraBusData.tripMapping)
  }
})

if (newRoutes === MilduraBusData.routes.length && oldRoutes > 0) {
  console.log('Deleting old Mildura routes')

  await dbRoutes.deleteDocuments({
    mode: TRANSIT_MODES.bus,
    routeGTFSID: {
      $in: Object.keys(MilduraBusData.tripMapping)
    }
  })
}

process.exit(0)