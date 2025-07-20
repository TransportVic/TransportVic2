import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import TripUpdater from '../new-tracker/trip-updater.mjs'

export default class VLineTripUpdater extends TripUpdater {
  
  static getMode() { return GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain }

  static async getTripByTDN(liveTimetables, runID, operationDay) {
    return await liveTimetables.findDocument({
      mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
      operationDays: operationDay,
      runID
    })
  }

  static async updateTripDestination(db, operationDay, runID, newDestination) {
    let timetables = db.getCollection('live timetables')
    let trip = await this.getTripByTDN(timetables, runID, operationDay)
    if (!trip) return null

    let tripStops = trip.stopTimings.map(stop => stop.stopName)
    let newDestinationIndex = tripStops.indexOf(newDestination)
    let cancelledStops = tripStops.slice(newDestinationIndex + 1)

    return await this.updateTrip(db, {
      operationDays: operationDay,
      runID,
      stops: cancelledStops.map(stopName => ({
        stopName,
        cancelled: true,
      }))
    }, {
      skipStopCancellation: true
    })
  }

}