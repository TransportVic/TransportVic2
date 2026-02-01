const utils = require('../../utils.mjs')
const termini = require('../../additional-data/termini-to-lines')

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
  "Wodonga",
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

let validALYOrigins = [
  'Broadmeadows',
  'Seymour',
  'Southern Cross'
].map(x => x + ' Railway Station')

let sssBAL = [ 'Southern Cross Railway Station', 'Ballarat Railway Station' ]
let artMYB = [ 'Southern Cross Railway Station', 'Ballarat Railway Station' ]
let sssFSS = [ 'Southern Cross Railway Station', 'Flinders Street Railway Station' ]

module.exports = async (collection, operationDay, origin, destination, departureTime) => {
  let tripStartMinutes = utils.getMinutesPastMidnightFromHHMM(departureTime)
  if (tripStartMinutes < 180) tripStartMinutes += 1440

  if (destination === 'Albury Railway Station' && validALYOrigins.includes(origin)) {
    destination = 'Wodonga Railway Station'
  }

  if (origin === 'Albury Railway Station' && validALYOrigins.includes(destination)) {
    origin = 'Wodonga Railway Station'
    tripStartMinutes += 20
  }

  let varianceAllowed = 5
  if (traralgonStops.includes(origin) || traralgonStops.includes(destination)) {
    varianceAllowed = 25
    if (origin === 'Pakenham Railway Station' || destination === 'Pakenham Railway Station') {
      varianceAllowed = 40
    }
    if (origin === 'Southern Cross Railway Station') origin = { $in: sssFSS }
    if (destination === 'Southern Cross Railway Station') destination = { $in: sssFSS }
  }

  // Maryborough/Ararat - Southern Cross
  if (origin === 'Ararat' || origin === 'Maryborough') {
    destination = { $in: sssBAL }
  }

  // Southern Cross - Maryborough/Ararat
  // If one cancelled eg SSS-MYB search for the ART as well and cancel that too
  if (destination === 'Ararat' || destination === 'Maryborough') {
    destination = { $in: artMYB }
  }

  if (destination === 'Bacchus Marsh') destination = 'Melton' // Deals with SSS-MEL, MEL-BMH trips (but as of now MEL-BMH left uncancelled)
  if (origin === 'Bacchus Marsh') origin = 'Melton' // Similar to down

  if (longDistanceCountryStops.includes(origin) || longDistanceCountryStops.includes(destination)) {
    varianceAllowed = 30
  }

  let variedDepartureTime = {
    $gte: tripStartMinutes - varianceAllowed,
    $lte: tripStartMinutes + varianceAllowed
  }

  let originRoute = (!origin.$in) ? termini[origin.slice(0, -16)] : null
  let destinationRoute = (!destination.$in) ? termini[destination.slice(0, -16)] : null

  let routeNames = [ originRoute, destinationRoute ].filter(Boolean)

  let strictQuery = {
    mode: 'regional train',
    operationDays: operationDay,
    origin,
    destination,
    'stopTimings.0.departureTimeMinutes': variedDepartureTime
  }

  let query = {
    $and: [{
      mode: 'regional train',
      operationDays: operationDay,
      routeName: { $in: routeNames }
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

  let matchedTrips = []
  let strictTrips = await collection.findDocuments(strictQuery).toArray()

  if (strictTrips.length) matchedTrips = strictTrips
  else {
    let dbQuery = collection.findDocuments(query)
    // if (collection.getCollectionName() === 'timetables') dbQuery.hint('vline matching index')
    matchedTrips = await dbQuery.toArray()
  }

  if (!matchedTrips.length) { // If no match try without route name - disruption/works could have made it shorter and not match
    delete query.$and[0].routeName
    let dbQuery = collection.findDocuments(query)
    // if (collection.getCollectionName() === 'timetables') dbQuery.hint('vline matching index')
    matchedTrips = await dbQuery.toArray()
  }

  function d(x) { return Math.abs(x.stopTimings[0].departureTimeMinutes - tripStartMinutes) }

  if (matchedTrips.length) {
    if (matchedTrips.length > 1) {
      let sorted = matchedTrips.sort((a, b) => d(a) - d(b))

      let specialTrain = sorted.find(trip => trip.routeGTFSID === '14-XPT' || trip.routeGTFSID === '10-GSR')
      let regularTrains = sorted.filter(trip => !(trip.routeGTFSID === '14-XPT' || trip.routeGTFSID === '10-GSR'))

      if (specialTrain && regularTrains.length) return regularTrains[0]
      else return specialTrain || regularTrains[0]
    } else {
      return matchedTrips[0]
    }
  }

  return null
}
