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

    let currentDestinationIndex = trip.stopTimings.findLastIndex(stop => !stop.cancelled)
    let newDestinationIndex = tripStops.indexOf(newDestination)

    let uncancelledStops = []
    let cancelledStops = tripStops.slice(newDestinationIndex + 1)
    if (currentDestinationIndex < newDestinationIndex) { // Trip getting extended
      uncancelledStops = tripStops.slice(currentDestinationIndex + 1, newDestinationIndex + 1)
    }

    return await this.updateTrip(db, {
      operationDays: operationDay,
      runID,
      stops: [
        ...uncancelledStops.map(stopName => ({
          stopName,
          cancelled: false,
        })),
        ...cancelledStops.map(stopName => ({
          stopName,
          cancelled: true,
        }))
      ]
    }, {
      skipStopCancellation: true
    })
  }

}