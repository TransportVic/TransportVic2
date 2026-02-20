import { GTFSReaders, GTFSTypes, TripLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import getTripID from '../../../modules/new-tracker/metro-rail-bus/get-trip-id.mjs'

import allRouteStops from '../../../additional-data/metro-data/metro-routes.json' with { type: 'json' }
import { MTMRailStop } from './MTMRailStopLoader.mjs'

let routesAtStops = {}

for (let route of Object.keys(allRouteStops)) {
  for (let stop of allRouteStops[route]) {
    if (!routesAtStops[stop]) routesAtStops[stop] = []
    routesAtStops[stop].push(route)
  }
}

let patternCache = {}
let directionCache = {}

export class MTMRailTrip extends GTFSTypes.GTFSTrip {

  constructor(data) {
    if (data.headsign && data.headsign.match(/^[A-Z]{2,3}\d{2,}/)) {
      data.block = data.headsign
    }

    super(data)
  }

  getPatternID() {
    return this.getStopData().map(stop => stop.stopName).join('-')
  }

  getRouteName(patternID) {
    if (patternCache[patternID]) return patternCache[patternID]

    let linesVisited = {}
    for (let stop of this.getStopData()) {
      let routes = routesAtStops[stop.stopName.slice(0, -16)]
      if (!routes) continue
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

    patternCache[patternID] = best
    return best
  }

  getDirection(routeName, patternID) {
    if (directionCache[patternID]) return directionCache[patternID]
    let routeStops = allRouteStops[routeName]
    if (!routeStops) return null

    let stopTimings = this.getStopData()
    let stopIndexes = stopTimings.reduce((acc, stop) => {
      let index = routeStops.indexOf(stop.stopName.slice(0, -16))
      if (index === -1) return acc
      acc[stop.stopName] = index
      return acc
    }, {})

    let indexIncreasing = 0, indexDecreasing = 0
    for (let i = 1; i < stopTimings.length; i++) {
      let stop = stopTimings[i].stopName, prev = stopTimings[i - 1].stopName
      if (stopIndexes[prev] < stopIndexes[stop]) indexIncreasing++
      else indexDecreasing++
    }

    let direction
    if (indexIncreasing > indexDecreasing) direction = 'Up'
    else direction = 'Down'

    directionCache[patternID] = direction
    return direction
  }

  getTripData() {
    let tripData = super.getTripData()
    let patternID = this.getPatternID()
    let routeName = this.getRouteName(patternID)

    return {
      ...tripData,
      routeName,
      direction: this.getDirection(routeName, patternID),
      runID: getTripID(tripData.tripID),
      isRailReplacementBus: true,
      isMTMRailTrip: true
    }
  }
}

export class MTMTripReader extends GTFSReaders.GTFSTripReader {

  constructor(tripsFile, calendarFile, routeIDMap) {
    super(tripsFile, calendarFile, routeIDMap, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain)
  }

  processEntity(data) {
    let tripData = {
      routeGTFSID: this.getRouteMapping(data.route_id),
      calendar: this.getCalendar(data.service_id.trim()),
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

  #operator

  constructor(stopTimesFile, operator) {
    super(stopTimesFile, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain)
    this.#operator = operator
  }

  processEntity(data) {
    let stopData = {
      arrivalTime: data.arrival_time,
      departureTime: data.departure_time,
      stopID: MTMRailStop.transformStopID(this.#operator, data.stop_id),
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
  #directionCache = {}

  #operator

  constructor(paths, operator, database) {
    super(paths, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, database)
    this.#operator = operator
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

  createStopTimesReader(stopTimesFile) {
    return new MTMRailStopTimesReader(stopTimesFile, this.#operator)
  }

  createTripReader(tripsFile, calendars, routeMappings) {
    return new MTMTripReader(tripsFile, calendars, routeMappings)
  }

  async loadTrips(routeIDMap) {
    await super.loadTrips({
      routeIDMap,
      processTrip: (trip, rawTrip) => {
        if (rawTrip.getCalendarName().match(/unplanned/i)) return null
        trip.flags = { operator: this.#operator }
        return trip
      }
    })
  }

  async writeTrips() {
    if (this.getTripsToLoad().length) {
      let tripsToLoad = this.getTripsToLoad()

      let bulkWrite = tripsToLoad.map(trip => ({
        replaceOne: {
          filter: {
            mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain,
            routeGTFSID: '2-RRB',
            tripID: trip.tripID
          },
          replacement: trip,
          upsert: true
        }
      }))

      if (bulkWrite.length) {
        await this.trips.bulkWrite(bulkWrite)
      }

      this.clearTripsToLoad()
    }
  }

}