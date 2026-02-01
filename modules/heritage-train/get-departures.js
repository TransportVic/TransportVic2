const departureUtils = require('../utils/get-bus-timetables.mjs')
const utils = require('../../utils.mjs')

async function getDepartures(stop, db) {
  try {
    let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'heritage train')

    return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'heritage train', 180, false)
  } catch (e) {
    return null
  }
}

module.exports = getDepartures
