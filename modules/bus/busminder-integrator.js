const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const tripMap = require('../../additional-data/busminder-trip-map')

const database = new DatabaseConnection(config.databaseURL, 'BusTracker')

database.connect(async err => {})

async function getTrip(busMinderID) {
  let now = utils.now()
  let trip = await database.getCollection('ventura bus trips').findDocument({
    runNumber: parseInt(busMinderID),
    date: now.format('YYYY-MM-DD'),
    timestamp: {
      $gt: utils.getPTMinutesPastMidnight(now) - 20
    }
  })

  if (trip) return 'V' + trip.fleet
  return null
}

module.exports = async trip => {
  let busMinderRouteGTFSIDs = [
    '7-TB1', '7-TB2', '7-TB3', '7-TB4', '7-TB7', '7-TB8', '7-TB9',
    '6-KWR', '5-V15'
  ]

  if (!busMinderRouteGTFSIDs.includes(trip.routeGTFSID)) return null

  let busMinderTrip = tripMap.filter(possibleTrip => { // change to db for indexing
    let tripGTFSIDMatch = possibleTrip.routeGTFSID ? possibleTrip.routeGTFSID === trip.routeGTFSID : true
    return possibleTrip.departureTime === trip.departureTime && possibleTrip.origin == trip.origin
      && possibleTrip.destination == trip.destination
  })[0]

  if (busMinderTrip)
    return await getTrip(busMinderTrip.trackerID)
  return null
}
