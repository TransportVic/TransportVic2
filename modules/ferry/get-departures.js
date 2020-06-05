const departureUtils = require('../utils/get-bus-timetables')
const utils = require('../../utils')

async function getDepartures(stop, db) {
  try {
    let gtfsIDs = departureUtils.getUniqueGTFSIDs(stop, 'ferry')

    return await departureUtils.getScheduledDepartures(gtfsIDs, db, 'ferry', 180, false)
  } catch (e) {
    return null
  }
}

module.exports = getDepartures
