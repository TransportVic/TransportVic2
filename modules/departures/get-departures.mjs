import utils from '../../utils.mjs'
import { getNonDSTMinutesPastMidnight } from '../dst/dst.mjs'
import convertToLive from './sch-to-live.mjs'

export default class Departures {
  
  /**
   * 
   * @param {Object} station The station data as stored in the database
   * @param {DatabaseConnection} db The database connection
   * @param {Date} departureTime The departure time to look from
   * @param {Number} timeframe The number of minutes worth of departures to capture
   * @param {Boolean} backwards If previous departures should be fetched
   */
  static async fetchLiveTrips(station, mode, db, departureTime, timeframe=120) {
    let liveTimetables = db.getCollection('live timetables')
    let stopGTFSIDs = station.bays
      .filter(bay => bay.mode === mode)
      .map(bay => bay.stopGTFSID)

    if (!stopGTFSIDs.length) stopGTFSIDs = station.bays.map(bay => bay.stopGTFSID)

    let timeMS = +departureTime
    let timeoutMS = timeframe * 60 * 1000

    let timeQuery = {
      $gte: timeMS - 1000 * 60,
      $lte: timeMS + timeoutMS
    }

    const trips = await liveTimetables.findDocuments({
      $or: [{
        mode,
        stopTimings: {
          $elemMatch: {
            stopGTFSID: {
              $in: stopGTFSIDs
            },
            actualDepartureTimeMS: timeQuery
          }
        }
      }, {
        mode,
        stopTimings: {
          $elemMatch: {
            stopGTFSID: {
              $in: stopGTFSIDs
            },
            scheduledDepartureTimeMS: timeQuery
          }
        }
      }]
    }).toArray()

    return trips
  }

  static getTripCollection(db) {
    return db.getCollection('gtfs timetables')
  }

  static getTripDay(operationDay) {
    return utils.getYYYYMMDD(operationDay)
  }

  static async fetchScheduledTrips(station, mode, db, departureTime, timeframe = 120) {
    let timetables = this.getTripCollection(db)
    let stopGTFSIDs = station.bays
      .filter(bay => bay.mode === mode)
      .map(bay => bay.stopGTFSID)

    // Get the non DST aware minutes past midnight - the times would be saved normally
    let rawDepartureTimeMinutes = getNonDSTMinutesPastMidnight(departureTime)
    let departureDay = utils.parseTime(departureTime).startOf('day')

    let trips = []

    for (let i = 1; i >= 0; i--) { // Run in reverse to get a naturally sorted order
      let minutesOffset = i * 1440 // Note - fix as 1440 first and have a think if it needs to be dynamic
      let operationDay = departureDay.clone().add(-i, 'days')

      let allowableTimes = {
        $gte: rawDepartureTimeMinutes - 1 + minutesOffset,
        $lte: rawDepartureTimeMinutes + timeframe + minutesOffset
      }

      let dayTrips = await timetables.findDocuments({
        mode,
        operationDays: this.getTripDay(operationDay),
        stopTimings: {
          $elemMatch: {
            stopGTFSID: {
              $in: stopGTFSIDs
            },
            $or: [{
              departureTimeMinutes: allowableTimes
            }, {
              arrivalTimeMinutes: allowableTimes
            }]
          }
        },
      }).toArray()

      trips.push(...dayTrips.map(trip => convertToLive(trip, operationDay)))
    }

    return trips
  }

  static getLiveTimetableCutoff() {
    return utils.now().startOf('day').add(2, 'days').set('hours', 3)
  }

  static shouldUseLiveDepartures(departureTime) {
    // Set to 3 hours as DST could mean there are actually 4 hours inbetween
    return departureTime < this.getLiveTimetableCutoff()
  }

  static async getCombinedDepartures(station, mode, db, {
    departureTime = null,
    timeframe = 120
  } = {}) {
    departureTime = departureTime ? utils.parseTime(departureTime) : utils.now()

    let useLive = this.shouldUseLiveDepartures(departureTime)
    let rawLiveTrips = await this.fetchLiveTrips(station, mode, db, departureTime, timeframe)
    let liveTrips = []
    let scheduledTrips = useLive ? [] : await this.fetchScheduledTrips(station, mode, db, departureTime, timeframe) 

    if (!useLive && rawLiveTrips.length) {
      for (let liveTrip of rawLiveTrips) {
        let matchingScheduled = scheduledTrips.findIndex(scheduled => {
          if (typeof liveTrip.runID !== 'undefined' && liveTrip.runID === scheduled.runID) return true
          if (typeof liveTrip.tripID !== 'undefined' && liveTrip.tripID === scheduled.tripID) return true
          if (
            liveTrip.origin === scheduled.origin && liveTrip.destination === scheduled.destination
            && liveTrip.departureTime === scheduled.departureTime
            && liveTrip.destinationArrivalTime === scheduled.destinationArrivalTime
          ) return true
        })
        // Always insert the live trip
        liveTrips.push(liveTrip)

        if (matchingScheduled !== -1) { // But if it matches, remove the original scheduled trip
          scheduledTrips.splice(matchingScheduled, 1)
        }
      }
    } else liveTrips = rawLiveTrips

    let departureEndTime = departureTime.clone().add(timeframe, 'minutes')

    // The departure time crossed the PT day and we need to use scheduled times for the rest
    if (useLive && !this.shouldUseLiveDepartures(departureEndTime)) {
      let ptDayStart = this.getLiveTimetableCutoff()
      let remainingMinutes = departureEndTime.diff(ptDayStart, 'minutes')

      let missingTrips = await this.fetchScheduledTrips(station, mode, db, ptDayStart, remainingMinutes)
      scheduledTrips.push(...missingTrips)
    }

    return { liveTrips, scheduledTrips }
  }

  static async getDepartures(station, mode, db, {
    departureTime = null,
    timeframe = 120,
    returnArrivals = false
  } = {}) {
    let stopGTFSIDs = station.bays.map(stop => stop.stopGTFSID)
    departureTime = departureTime ? utils.parseTime(departureTime) : utils.now()

    let { liveTrips, scheduledTrips } = await this.getCombinedDepartures(station, mode, db, { departureTime, timeframe })
    let departures = []

    const processTrip = isLive => trip => {
      let stopIndices = trip.stopTimings
        .slice(0, returnArrivals ? trip.stopTimings.length : -1) // Exclude the last stop
        .map((stop, i) => ({ m: stopGTFSIDs.includes(stop.stopGTFSID), i }))
        .filter(e => e.m)
        .map(e => e.i)

      let prevVisitSchDep = null

      for (const currentStopIndex of stopIndices) {
        const currentStop = trip.stopTimings[currentStopIndex]
        const cancelled = trip.cancelled || currentStop.cancelled

        const scheduledDepartureTime = utils.parseTime(currentStop.scheduledDepartureTime)
        const estimatedDepartureTime = (currentStop.estimatedDepartureTime && !cancelled) ? utils.parseTime(currentStop.estimatedDepartureTime) : null

        if (prevVisitSchDep !== null && scheduledDepartureTime.diff(prevVisitSchDep, 'minutes') <= 2) continue
        prevVisitSchDep = scheduledDepartureTime
        
        const actualDepartureTime = estimatedDepartureTime || scheduledDepartureTime
        const isEarly = departureTime.diff(actualDepartureTime, 'minutes') > 1
        if (isEarly) continue

        departures.push({
          scheduledDepartureTime,
          estimatedDepartureTime,
          actualDepartureTime,
          currentStop,
          cancelled,
          routeName: trip.routeName,
          cleanRouteName: utils.encodeName(trip.routeName),
          trip,
          destination: trip.destination,
          departureDay: trip.operationDays,
          departureDayMoment: utils.parseDate(trip.operationDays),
          allStops: trip.stopTimings.map(stop => stop.stopName),
          futureStops: trip.stopTimings.slice(currentStopIndex + 1).map(stop => stop.stopName),
          isArrival: currentStopIndex === trip.stopTimings.length - 1,
          isLive
        })
      }
    }

    liveTrips.forEach(processTrip(true))
    scheduledTrips.forEach(processTrip(false))

    return departures.sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
  }
}

export const fetchLiveTrips = function() { return Departures.fetchLiveTrips(...arguments) }
export const fetchScheduledTrips = function() { return Departures.fetchScheduledTrips(...arguments) }
export const getCombinedDepartures = function() { return Departures.getCombinedDepartures(...arguments) }
export const getDepartures = function() { return Departures.getDepartures(...arguments) }
export const shouldUseLiveDepartures = function() { return Departures.shouldUseLiveDepartures(...arguments) }