const departureUtils = require('../utils/get-train-timetables')

async function getDepartures(station, db) {
  return await departureUtils.getScheduledDepartures(station, db, 'regional coach', 120)
}

module.exports = getDepartures
