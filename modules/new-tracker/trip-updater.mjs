import LiveTimetable from '../schema/live-timetable.js'

const err = global.loggers ? global.loggers.trackers.generic.err : console.error

let stopIDCache = {}
let stopCache = {}

let routeIDCache = {}
let routeNameCache = {}

export default class TripUpdater {

  static getMode() {
    throw new Error('TripUpdater mode not defined')
  }

  static async getTrip(db, runID, date) {
    let liveTimetables = db.getCollection('live timetables')
    return await liveTimetables.findDocument({
      mode: this.getMode(),
      runID,
      operationDays: date
    })
  }

  static async getStop(db, stopID) {
    if (stopIDCache[stopID]) return stopCache[stopIDCache[stopID]].bays.find(bay => bay.stopGTFSID == stopID)

    let stops = db.getCollection('stops')
    let stop = await stops.findDocument({
      'bays.stopGTFSID': stopID
    })

    if (!stop) return null

    stopCache[stop.stopName] = stop
    stopIDCache[stopID] = stop.stopName

    return stop.bays.find(bay => bay.stopGTFSID == stopID)
  }

  static async getStopByName(db, stopName) {
    if (stopCache[stopName]) return stopCache[stopName]

    let stops = db.getCollection('stops')
    let stop = await stops.findDocument({
      stopName
    })

    if (!stop) return null

    stopCache[stopName] = stop
    return stop
  }

  static async getRoute(db, routeGTFSID) {
    if (routeIDCache[routeGTFSID]) return routeIDCache[routeGTFSID]

    let routes = db.getCollection('routes')
    let route = await routes.findDocument({
      mode: this.getMode(),
      routeGTFSID
    })

    if (!route) return null

    routeNameCache[routeGTFSID] = route
    routeIDCache[route.routeGTFSID] = route

    return route
  }

  static async getRouteByName(db, routeName) {
    if (routeNameCache[routeName]) return routeNameCache[routeName]

    let routes = db.getCollection('routes')
    let route = await routes.findDocument({
      mode: this.getMode(),
      routeName
    })

    if (!route) return null

    routeNameCache[routeName] = route
    routeIDCache[route.routeGTFSID] = route

    return route
  }

  static async getBaseStopUpdateData(db, stop) {
    let stopData = await this.getStopByName(db, stop.stopName)
    let platformBay
    let mode = this.getMode()

    if (stop.platform) {
      platformBay = stopData.bays.find(bay => bay.mode === mode && bay.platform === stop.platform)
    }

    if (!platformBay) {
      platformBay = stopData.bays.find(bay => bay.mode === mode && bay.stopType == 'station')
    }

    if (!platformBay) return {}

    let updatedData = {
      stopGTFSID: platformBay.parentStopGTFSID || platformBay.stopGTFSID,
      stopNumber: null,
      suburb: platformBay.suburb
    }

    return {
      stopData, platformBay, updatedData
    }
  }

  static async updateTrackerData(db, timetable) {
    let key = timetable.getTrackerDatabaseKey()
    let tripsDB = db.getCollection(`${this.getMode()} trips`)
    if (key) await tripsDB.replaceDocument(key, timetable.toTrackerDatabase(), {
      upsert: true
    })
  }

  static setUpTimetable(timetable, trip) {
    timetable.cancelled = trip.cancelled
    if (trip.cancelled) {
      if (trip.stops && trip.stops.length) {
        trip.stops.forEach(stop => {
          stop.estimatedDepartureTime = null
          stop.estimatedArrivalTime = null
        })
      } else trip.stops = null
    }

    if (trip.forming) timetable.forming = trip.forming
    if (trip.formedBy) timetable.formedBy = trip.formedBy
    if (trip.consist) timetable.consist = trip.consist.reduce((acc, e) => acc.concat(e), [])
    else if (trip.forcedVehicle) timetable.forcedVehicle = trip.forcedVehicle

    timetable.runID = trip.runID
  }

  static adjustTripInput(timetable, trip) {
  }

  static getLastStopDelay(timetable, trip, stopVisits) {
    let lastNonAMEXStop = timetable.stops.findLastIndex(stop => !stop.cancelled)
    let secondLastStop, lastStop
    if (lastNonAMEXStop > 0) {
      secondLastStop = timetable.stops[lastNonAMEXStop - 1]
      lastStop = timetable.stops[lastNonAMEXStop]
    }

    let lastStopHasETA = trip.stops && trip.stops.length > 1
      && trip.stops[trip.stops.length - 1].stopName === lastNonAMEXStop.stopName
      && (trip.stops[trip.stops.length - 1].estimatedArrivalTime || trip.stops[trip.stops.length - 1].estimatedDepartureTime)

    if (secondLastStop && stopVisits[secondLastStop.stopName] && !lastStopHasETA && secondLastStop.estimatedDepartureTime) {
      let secondLastDelay = secondLastStop.estimatedDepartureTime.diff(secondLastStop.scheduledDepartureTime, 'minutes')
      return { lastStopDelay: secondLastDelay, lastStop, secondLastStop }
    }

    return { lastStopDelay: null, lastStop, secondLastStop, lastNonAMEXStop }
  }

  static requireStrictTimingMatch(trip) {
    return false
  }

  static async updateTripDetails(db, timetable, trip, skipStopCancellation, ignoreMissingStops, stopVisits) {
    let existingStops = timetable.getStopNames()

    for (let stop of trip.stops) {
      let { stopData, updatedData } = await this.getBaseStopUpdateData(db, stop)
      if (!stopData) {
        err('Failed to update stop ' + JSON.stringify(trip), stop)
        continue
      }

      if (!stopVisits[stop.stopName]) stopVisits[stop.stopName] = 0
      stopVisits[stop.stopName]++

      if (!existingStops.includes(stop.stopName)) updatedData.additional = true
      if (stop.platform) updatedData.platform = stop.platform
      if (typeof stop.cancelled !== 'undefined') updatedData.cancelled = stop.cancelled
      else if (!skipStopCancellation) updatedData.cancelled = false

      if (stop.scheduledDepartureTime) updatedData.scheduledDepartureTime = stop.scheduledDepartureTime.toISOString()
      if (stop.estimatedDepartureTime) updatedData.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()
      if (stop.estimatedArrivalTime) updatedData.estimatedArrivalTime = stop.estimatedArrivalTime.toISOString()

      let matchingCriteria = this.requireStrictTimingMatch(trip) ? { prefSchTime: stop.scheduledDepartureTime.toISOString() } : { visitNum: stopVisits[stop.stopName] }
      timetable.updateStopByName(stopData.stopName, updatedData, matchingCriteria)
    }

    if (!skipStopCancellation) {
      for (let stop of existingStops) {
        if (!stopVisits[stop] && !ignoreMissingStops.includes(stop)) {
          timetable.updateStopByName(stop, {
            cancelled: true
          })
        }
      }
    }
  }

  static async updateTrip(db, trip, {
    skipWrite = false,
    skipStopCancellation = false,
    dataSource = 'unknown',
    ignoreMissingStops = [],
    updateTime = null
  } = {}) {
    let dbTrip = await this.getTrip(db, trip.runID, trip.operationDays)
    let liveTimetables = db.getCollection('live timetables')

    let timetable
    let stopVisits = {}

    if (dbTrip) {
      timetable = LiveTimetable.fromDatabase(dbTrip)
      if (updateTime) timetable.lastUpdated = updateTime

      timetable.setModificationSource(dataSource)
      let firstNonAMEXStop = timetable.stops.find(stop => !stop.cancelled)
      let firstStop = timetable.stops[0]
      if (trip.scheduledStartTime && ![firstStop.departureTime, firstNonAMEXStop?.departureTime].includes(trip.scheduledStartTime)) return null

      this.setUpTimetable(timetable, trip)
      this.adjustTripInput(timetable, trip)

      if (trip.stops) {
        await this.updateTripDetails(db, timetable, trip, skipStopCancellation, ignoreMissingStops, stopVisits)
      }
    } else {
      timetable = await this.createTrip(db, trip, updateTime, stopVisits, dataSource)
    }

    if (!timetable) return null

    timetable.sortStops()

    let { lastStopDelay, lastStop } = this.getLastStopDelay(timetable, trip, stopVisits)
    if (lastStopDelay !== null) {
      let lastStopEstArr = lastStop.scheduledDepartureTime.clone().add(lastStopDelay, 'minutes')
      lastStop.estimatedArrivalTime = lastStopEstArr
      lastStop.estimatedDepartureTime = lastStopEstArr
    }

    timetable.stops[0].allowDropoff = false
    timetable.stops[timetable.stops.length - 1].allowPickup = false

    if (!skipWrite) await liveTimetables.replaceDocument(timetable.getDBKey(), timetable.toDatabase(), {
      upsert: true
    })

    await this.updateTrackerData(db, timetable)

    return timetable
  }

  static async createTrip(db, trip, updateTime, stopVisits, dataSource) {
    let routeData = await this.getRoute(db, trip.routeGTFSID)

    let timetable = new LiveTimetable(
      this.getMode(),
      trip.operationDays,
      routeData.routeName,
      routeData.routeNumber,
      routeData.routeGTFSID,
      null,
      null,
      updateTime
    )

    timetable.setModificationSource(dataSource)
    timetable.logChanges = false
    timetable.isRRB = false
    timetable.direction = trip.runID[3] % 2 === 0 ? 'Up' : 'Down'

    this.setUpTimetable(timetable, trip)
    if (!trip.stops || !trip.stops.length) return null

    for (let stop of trip.stops) {
      let { stopData, updatedData } = await this.getBaseStopUpdateData(db, stop)

      if (!stopVisits[stop.stopName]) stopVisits[stop.stopName] = 0
      stopVisits[stop.stopName]++

      if (stop.platform) updatedData.platform = stop.platform

      if (stop.scheduledDepartureTime) updatedData.scheduledDepartureTime = stop.scheduledDepartureTime.toISOString()
      else if (stop.estimatedDepartureTime) updatedData.scheduledDepartureTime = stop.estimatedDepartureTime.toISOString()
      else if (stop.estimatedArrivalTime) updatedData.scheduledDepartureTime = stop.estimatedArrivalTime.toISOString()
      else throw new Error('Stop has no scheduled or estimated time ' + JSON.stringify(trip, null, 2))

      if (stop.estimatedDepartureTime) updatedData.estimatedDepartureTime = stop.estimatedDepartureTime.toISOString()

      let matchingCriteria = this.requireStrictTimingMatch(trip) ? { prefSchTime: stop.scheduledDepartureTime.toISOString() } : { visitNum: stopVisits[stop.stopName] }
      timetable.updateStopByName(stopData.stopName, updatedData, matchingCriteria)
    }

    return timetable
  }

}