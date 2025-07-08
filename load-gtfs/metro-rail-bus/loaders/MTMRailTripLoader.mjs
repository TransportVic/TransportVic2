import { GTFSReaders, GTFSTypes, TripLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

export class MTMRailStopTimesReader extends GTFSReaders.GTFSStopTimesReader {

  processEntity(data) {
    let stopData = {
      arrivalTime: data.arrival_time,
      departureTime: data.departure_time,
      stopID: 'RAIL_' + data.stop_id,
      stopSequence: data.stop_sequence,
      pickup: data.pickup_type,
      dropoff: data.drop_off_type,
      distance: data.shape_dist_traveled
    }

    return new GTFSTypes.GTFSStopTime(stopData)
  }

}

export default class MTMRailTripLoader extends TripLoader {

  constructor(paths, database) {
    super(paths, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, database)
  }

  getRoutesDB(db) {
    return db.getCollection('routes')
  }

  getStopsDB(db) {
    return db.getCollection('stops')
  }

  getTripsDB(db) {
    return db.getCollection('gtfs timetables')
  }

  createStopTimesReader(stopTimesFile, mode) {
    return new MTMRailStopTimesReader(stopTimesFile, mode)
  }

  async loadTrips(routeIDMap) {
    await super.loadTrips({
      routeIDMap,
      processTrip: (trip, rawTrip) => {
        if (rawTrip.getCalendarName().match(/unplanned/i)) return null
        return trip
      }
    })
  }

}