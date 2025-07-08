import { GTFSReaders, GTFSTypes, RouteLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

export class MTMRailRoute extends GTFSTypes.GTFSRoute {

  constructor(data) {
    super(data)
    this.routeName = 'Rail Replacement Bus'
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

    return MTMRailRoute(routeData, this.getMode())
  }

}

export default class MTMRailRouteLoader extends RouteLoader {

  constructor(routesFile, agencyFile, database) {
    super(routesFile, agencyFile, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, database)
  }

  getRoutesDB(db) {
    return db.getCollection('routes')
  }

}