import { GTFSReaders, GTFSTypes, TripLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import getTripID from '../../../modules/new-tracker/metro-rail-bus/get-trip-id.mjs'

import routeStops from '../../../additional-data/metro-data/metro-routes.json' with { type: 'json' }
let routesAtStops = {}

for (let route of Object.keys(routeStops)) {
  for (let stop of routeStops[route]) {
    if (!routesAtStops[stop]) routesAtStops[stop] = []
    routesAtStops[stop].push(route)
  }
}

export class MTMRailTrip extends GTFSTypes.GTFSTrip {

  constructor(data) {
    if (data.headsign && data.headsign.length === 6 && data.headsign.match(/[A-Z]{3}\d{3}/)) {
      data.block = data.headsign
    }

    super(data)
  }

  static canProcess(data, mode) {
    return mode === TRANSIT_MODES.metroTrain && data.routeGTFSID === '2-RRB'
  }

  getTripData() {
    return {
      ...super.getTripData(),
      isRailReplacementBus: true
    }
  }
}

export class MTMTripReader extends GTFSReaders.GTFSTripReader {

  processEntity(data) {
    let tripData = {
      routeGTFSID: this.getRouteMapping(data.route_id),
      calendar: this.getCalendar(data.service_id),
      id: data.trip_id,
      shapeID: data.shape_id,
      headsign: data.trip_headsign,
      direction: data.direction_id,
      block: data.block_id
    }

    return new MTMRailTrip(tripData, this.getMode())
  }

}

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

  #patternCache = {}

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

  createTripReader(tripsFile, calendars, routeMappings, mode) {
    return new MTMTripReader(tripsFile, calendars, routeMappings, mode)
  }

  async loadTrips(routeIDMap) {
    await super.loadTrips({
      routeIDMap,
      processTrip: (trip, rawTrip) => {
        if (rawTrip.getCalendarName().match(/unplanned/i)) return null
        trip.runID = getTripID(trip.tripID)

        let patternID = trip.stopTimings.map(stop => stop.stopName).join('-')
        if (!this.#patternCache[patternID]) {
          let linesVisited = {}
          for (let stop of trip.stopTimings) {
            let routes = routesAtStops[stop.stopName.slice(0, -16)]
            for (let route of routes) {
              if (!linesVisited[route]) linesVisited[route] = 0
              linesVisited[route]++
            }
          }

          let best = null, bestCount = 0
          for (let route of Object.keys(linesVisited)) {
            if (linesVisited[route] > bestCount) {
              bestCount = linesVisited[route]
              best = route
            }

          }
          
          this.#patternCache[patternID] = best
        }
        trip.routeName = this.#patternCache[patternID]

        return trip
      }
    })
  }

}