import { GTFSReaders, GTFSTypes, TripLoader } from '@transportme/load-ptv-gtfs'

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

  getRoutesDB(db) {
    return db.getCollection('routes')
  }

  getStopsDB(db) {
    return db.getCollection('stops')
  }

  getTripsDB(db) {
    return db.getCollection('gtfs timetables')
  }

  createStopTimesReader() {
    return new MTMRailStopTimesReader(stopTimesFile, mode)
  }

}