import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import TripUpdater from '../new-tracker/trip-updater.mjs'

export default class BusTripUpdater extends TripUpdater {
  
  static getMode() { return GTFS_CONSTANTS.TRANSIT_MODES.bus }
  static getTrackerDB() { return 'bus trips' }

  static async getTripByTripID(liveTimetables, tripID, operationDay) {
    return await liveTimetables.findDocument({
      mode: this.getMode(),
      operationDays: operationDay,
      tripID
    })
  }
}