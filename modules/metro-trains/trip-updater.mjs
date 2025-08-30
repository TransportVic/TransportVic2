import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import TripUpdater from '../new-tracker/trip-updater.mjs'

export default class MetroTripUpdater extends TripUpdater {
  
  static getMode() { return GTFS_CONSTANTS.TRANSIT_MODES.metroTrain }
  static getTrackerDB() { return 'metro trips' }

  static adjustTripInput(timetable, trip) {
    if (timetable.direction === 'Up' && trip.stops && trip.stops.length) {
      let updateLastStop = trip.stops[trip.stops.length - 1]
      let isFSS = timetable.destination === 'Flinders Street Railway Station'
      if (isFSS && updateLastStop.stopName === timetable.destination) {
        trip.stops[trip.stops.length - 1].scheduledDepartureTime = null
      }
    }
  }

  static getLastStopDelay(timetable, trip, stopVisits) {
    let lastStopData = super.getLastStopDelay(timetable, trip, stopVisits)
    let { lastStopDelay, lastStop, secondLastStop, lastNonAMEXStop } = lastStopData
    if (lastStopDelay !== null) return lastStopData

    if (secondLastStop && secondLastStop.cancelled && !lastStop.cancelled && lastStop.stopName === 'Flinders Street Railway Station') {
      let secondLastStopNonAMEX = timetable.stops.findLast((stop, i) => !stop.cancelled && i < lastNonAMEXStop)
      if (secondLastStopNonAMEX && secondLastStopNonAMEX.stopName === 'Richmond Railway Station') {
        let rmdDelay = secondLastStopNonAMEX.estimatedDepartureTime.diff(secondLastStopNonAMEX.scheduledDepartureTime, 'minutes')
        return { lastStopDelay: rmdDelay - 10, lastStop, secondLastStop, lastNonAMEXStop }
      } else if (secondLastStopNonAMEX && secondLastStopNonAMEX.stopName === 'North Melbourne Railway Station') {
        let nmeDelay = secondLastStopNonAMEX.estimatedDepartureTime.diff(secondLastStopNonAMEX.scheduledDepartureTime, 'minutes')
        return { lastStopDelay: nmeDelay - 3, lastStop, secondLastStop, lastNonAMEXStop }
      }
    }

    return lastStopData
  }

  static requireStrictTimingMatch(trip) {
    return trip.routeGTFSID === '2-CCL'
  }
}