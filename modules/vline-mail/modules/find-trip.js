const utils = require('../../../utils')

module.exports = async (collection, operationDay, origin, destination, departureTime) => {
  let tripStartMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime)

  let variedDepartureTime = {
    $gte: tripStartMinutes - 5,
    $lte: tripStartMinutes + 5
  }

  let query = {
    $and: [{
      mode: 'regional train',
      operationDays: operationDay
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: origin,
          departureTimeMinutes: variedDepartureTime
        }
      }
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: destination
        }
      }
    }]
  }

  let matchedTrips = await collection.findDocuments(query).toArray()
  function d(x) { return Math.abs(x.stopTimings[0].departureTimeMinutes - tripStartMinutes) }

  if (matchedTrips.length) {
    if (matchedTrips.length > 1) {
      return matchedTrips.sort((a, b) => d(a) - d(b))[0]
    } else {
      return matchedTrips[0]
    }
  }

  return null
}
