/**
 * 
 * @param {Object} station The station data as stored in the database
 * @param {DatabaseConnection} db The database connection
 * @param {Date} departureTime The departure time to look from
 * @param {Number} timeframe The number of minutes worth of departures to capture
 */
async function fetchLiveTrips(station, db, departureTime, timeframe) {
  return []
}

async function getDepartures(station, db, options={}) {
  let { lookBackwards, departureTime } = options
}

module.exports = {
  fetchLiveTrips,
  getDepartures
}