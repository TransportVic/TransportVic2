import departureUtils from '../utils/get-bus-timetables.mjs'

export default async function getDepartures(stop, db) {
  try {
    let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'ferry')

    return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'ferry', 180, false)
  } catch (e) {
    return null
  }
}