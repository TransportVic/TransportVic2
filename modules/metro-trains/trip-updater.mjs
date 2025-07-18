import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import TripUpdater from '../new-tracker/trip-updater.mjs'

export default class MetroTripUpdater extends TripUpdater {
  static getMode() { return GTFS_CONSTANTS.TRANSIT_MODES.metroTrain }
}