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

let traralgonStops = [
  'Richmond',
  'Caulfield',
  'Clayton',
  'Dandenong',
  'Berwick',
  'Pakenham',
  'Nar Nar Goon',
  'Tynong',
  'Garfield',
  'Bunyip',
  'Longwarry',
  'Drouin',
  'Warragul',
  'Yarragon',
  'Trafalgar',
  'Moe',
  'Morwell',
  'Traralgon',
  'Rosedale',
  'Sale',
  'Stratford',
  'Bairnsdale'
].map(x => x + ' Railway Station')

let validALBOrigins = [
  'Broadmeadows',
  'Seymour',
  'Southern Cross'
].map(x => x + ' Railway Station')

module.exports = async (collection, operationDay, origin, destination, departureTime) => {
  let tripStartMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime)
  if (tripStartMinutes < 180) tripStartMinutes += 1440

  if (destination === 'Albury Railway Station' && validALBOrigins.includes(origin)) {
    destination = 'Wodonga Railway Station'
  }

  if (origin === 'Albury Railway Station' && validALBOrigins.includes(destination)) {
    origin = 'Wodonga Railway Station'
    tripStartMinutes += 20
  }


  let varianceAllowed = 5
  if (traralgonStops.includes(origin) || traralgonStops.includes(destination)) {
    varianceAllowed = 20
  }

  if (longDistanceCountryStops.includes(origin) || longDistanceCountryStops.includes(destination)) {
    varianceAllowed = 25
  }

  let variedDepartureTime = {
    $gte: tripStartMinutes - varianceAllowed,
    $lte: tripStartMinutes + varianceAllowed
  }

  let routeGTFSID = { $not: { $in: [] } }
  let syd = 'Sydney Central Railway Station'
  if (destination !== syd && origin !== syd) {
    routeGTFSID.$not.$in.push('14-XPT')
  }

  let ade = 'Adelaide Railway Station'
  if (destination !== ade && origin !== ade) {
    routeGTFSID.$not.$in.push('10-GSR')
  }

  let query = {
    $and: [{
      mode: 'regional train',
      operationDays: operationDay,
      routeGTFSID
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
