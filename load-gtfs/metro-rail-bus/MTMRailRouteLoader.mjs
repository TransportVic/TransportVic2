import { RouteLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

export default class MTMRailRouteLoader extends RouteLoader {

  constructor(routesFile, agencyFile, database) {
    super(routesFile, agencyFile, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, database)
  }

  getRoutesDB(db) {
    return db.getCollection('routes')
  }

}