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

  static #getCancelledFromLateOrigination(trip, tripStops, newOrigin) {
    let currentOriginIndex = trip.stopTimings.findIndex(stop => !stop.cancelled)
    let newOriginIndex = tripStops.indexOf(newOrigin)

    let uncancelledStops = []
    let cancelledStops = tripStops.slice(0, newOriginIndex)
    if (newOriginIndex < currentOriginIndex) { // Trip getting extended
      uncancelledStops = tripStops.slice(newOriginIndex, currentOriginIndex + 1)
    }

    return { cancelledStops, uncancelledStops }
  }

  static #getCancelledFromEarlyTermination(trip, tripStops, newDestination) {
    let currentDestinationIndex = trip.stopTimings.findLastIndex(stop => !stop.cancelled)
    let newDestinationIndex = tripStops.indexOf(newDestination)

    let uncancelledStops = []
    let cancelledStops = tripStops.slice(newDestinationIndex + 1)
    if (currentDestinationIndex < newDestinationIndex) { // Trip getting extended
      uncancelledStops = tripStops.slice(currentDestinationIndex + 1, newDestinationIndex + 1)
    }

    return { cancelledStops, uncancelledStops }
  }

  static async updateTripOriginDestination(db, operationDay, runID, newOrigin, newDestination) {
    let timetables = db.getCollection('live timetables')
    let trip = await this.getTripByTDN(timetables, runID, operationDay)
    if (!trip) return null

    let tripStops = trip.stopTimings.map(stop => stop.stopName)

    let { cancelledStops: originCancelledStops, uncancelledStops: originUncancelledStops } = this.#getCancelledFromLateOrigination(trip, tripStops, newOrigin)
    let { cancelledStops: destCancelledStops, uncancelledStops: destUncancelledStops } = this.#getCancelledFromEarlyTermination(trip, tripStops, newDestination)

    return await this.updateTrip(db, {
      operationDays: operationDay,
      runID,
      stops: [
        ...originUncancelledStops.concat(destUncancelledStops).map(stopName => ({
          stopName,
          cancelled: false,
        })),
        ...originCancelledStops.concat(destCancelledStops).map(stopName => ({
          stopName,
          cancelled: true,
        }))
      ]
    }, {
      skipStopCancellation: true
    })
  }

  static async setTripTimeOffset(db, operationDay, runID, timeOffset) {
    let timetables = db.getCollection('live timetables')
    let trip = await this.getTripByTDN(timetables, runID, operationDay)
    if (!trip) return null

    return await this.updateTrip(db, {
      operationDays: operationDay,
      runID,
      stops: trip.stopTimings.map(stop => ({
        stopName: stop.stopName,
        scheduledDepartureTime: new Date(+new Date(stop.scheduledDepartureTime) + timeOffset)
      }))
    }, {
      skipStopCancellation: true
    })
  }

}