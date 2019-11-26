const DatabaseConnection = require('./database/DatabaseConnection')
const config = require('./config.json')
const utils = require('./utils')
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async err => {
  let busTrips = database.getCollection('bus trips')
  let allTrips = await busTrips.findDocuments().toArray()
  await async.forEachLimit(allTrips, 200, async trip => {
    let {date, routeGTFSID, origin, destination, departureTime, destinationArrivalTime} = trip
    let key = {
      date, routeGTFSID, origin, destination, departureTime, destinationArrivalTime
    }

    let newOrigin = utils.adjustStopname(origin),
        newDestination = utils.adjustStopname(destination)

    if (newOrigin == origin && newDestination == destination) return

    if (await busTrips.findDocument({
      date, routeGTFSID, departureTime, destinationArrivalTime,
      origin: newOrigin, destination: newDestination
    })) {
      await busTrips.deleteDocument({_id: trip._id})
    } else {
      trip.origin = newOrigin
      trip.destination = newDestination
      await busTrips.replaceDocument(key, trip)
    }
  })
  console.log('Completed updating ' + allTrips.length + ' trips')
  process.exit(0)
})
