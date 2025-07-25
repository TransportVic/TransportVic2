import { GTFSReaders, GTFSTypes, RouteLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

export class MTMRailRoute extends GTFSTypes.GTFSRoute {

  static ROUTE_NAME = 'Rail Replacement Bus'

  constructor(data) {
    super(data)
    this.routeName = this.constructor.ROUTE_NAME
    this.routeNumber = null
  }

  static canProcess(routeGTFSID, mode) {
    return !routeGTFSID.match(/^\d+-\w{1,3}/) && mode === 'metro train'
  }

  parseRouteID() {
    return '2-RRB'
  }  

}

export class MTMRailRouteReader extends GTFSReaders.GTFSRouteReader {

  processEntity(data) {
    let routeData = {
      routeGTFSID: data.route_id,
      agencyID: data.agency_id,
      routeNumber: data.route_short_name,
      routeName: data.route_long_name
    }

    return new MTMRailRoute(routeData, this.getMode())
  }

}

export default class MTMRailRouteLoader extends RouteLoader {

  constructor(routesFile, agencyFile, database) {
    super(routesFile, agencyFile, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, database)
  }

  createRouteReader(routesFile, agencyFile) {
    return new MTMRailRouteReader(routesFile, agencyFile)
  }

  getRoutesDB(db) {
    return db.getCollection('routes')
  }

}