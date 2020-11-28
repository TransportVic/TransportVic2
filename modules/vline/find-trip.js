const utils = require('../../utils')

let longDistanceCountryStops = [
  "Albury",
  "Ararat",
  "Avenel",
  "Bairnsdale",
  "Beaufort",
  "Benalla",
  "Birregurra",
  "Broadford",
  "Camperdown",
  "Chiltern",
  "Colac",
  "Dingee",
  "Echuca",
  "Euroa",
  "Kerang",
  "Mooroopna",
  "Murchison East",
  "Nagambie",
  "Pyramid",
  "Rochester",
  "Rosedale",
  "Sale",
  "Shepparton",
  "Springhurst",
  "Stratford",
  "Swan Hill",
  "Terang",
  "Violet Town",
  "Wangaratta",
  "Warrnambool",
  "Winchelsea",
  "Sherwood Park",
  "Creswick",
  "Clunes",
  "Maryborough",
  "Talbot",
  "Epsom"
].map(x => x + ' Railway Station')

module.exports = async (collection, operationDay, origin, destination, departureTime) => {
  let tripStartMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime)
  if (tripStartMinutes < 180) tripStartMinutes += 1440

  let varianceAllowed = 5
  if (longDistanceCountryStops.includes(origin) || longDistanceCountryStops.includes(destination)) {
    varianceAllowed = 25
  }

  let variedDepartureTime = {
    $gte: tripStartMinutes - varianceAllowed,
    $lte: tripStartMinutes + varianceAllowed
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
          stopName: destination,
          arrivalTimeMinutes: {
            $gt: tripStartMinutes
          }
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
