import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

export default class VLineUtils {

  static async getNSPTrip(dayOfWeek, runID, db) {
    let timetables = await db.getCollection('timetables')
    return await timetables.findDocument({
      mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
      operationDays: dayOfWeek,
      runID
    })
  }

}