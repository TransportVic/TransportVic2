const departureUtils = require('../utils/get-bus-timetables')
const async = require('async')

async function getDepartures(station, db) {
  let gtfsIDs = departureUtils.getUniqueGTFSIDs(station, 'regional coach', false)

  return (await async.map(gtfsIDs, async gtfsID => {
    return await departureUtils.getScheduledDepartures(gtfsID, db, 'regional coach', 120)
  })).reduce((acc, departures) => {
    return acc.concat(departures)
  }, [])
}

module.exports = getDepartures
