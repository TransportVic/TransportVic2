import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import TripUpdater from '../new-tracker/trip-updater.mjs'
import convertToLive from '../departures/sch-to-live.mjs'
import { BusLiveTimetable } from '../schema/live-timetable.mjs'

export default class BusTripUpdater extends TripUpdater {

  static getMode() { return GTFS_CONSTANTS.TRANSIT_MODES.bus }
  static getTrackerDB() { return 'bus trips' }

  static createLiveTimetable(data) {
    return new BusLiveTimetable(...data)
  }

  static async getTrip(db, runID, date, routeGTFSID) {
    const tripData = await super.getTrip(db, runID, date, routeGTFSID)
    if (tripData) return tripData

    const gtfsTimetables = db.getCollection('gtfs timetables')
    const otherDay = await gtfsTimetables.findDocument({
      mode: this.getMode(),
      runID,
      routeGTFSID
    })

    if (otherDay) return convertToLive(otherDay, date)
  }

}