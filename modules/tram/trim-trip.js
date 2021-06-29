const async = require('async')
const utils = require('../../utils')
const tramDestinations = require('../../additional-data/tram-destinations')
const { closest, distance } = require('fastest-levenshtein')

let tramDestinationLookup = {}

Object.keys(tramDestinations).forEach(dest => {
  let humanName = tramDestinations[dest]
  if (!tramDestinationLookup[humanName]) tramDestinationLookup[humanName] = []
  tramDestinationLookup[humanName].push(dest)
})

let knownDestinations = Object.keys(tramDestinationLookup)

async function getStopData(stopGTFSID, stops) {
  return await utils.getData('tram-stops', stopGTFSID, async () => {
    return await stops.findDocument({ 'bays.stopGTFSID': stopGTFSID })
  }, 1000 * 60 * 30)
}

async function modifyTrip(db, trip, operationDay) {
  trip.origin = trip.stopTimings[0].stopName
  trip.destination = trip.stopTimings.slice(-1)[0].stopName
  trip.departureTime = trip.stopTimings[0].departureTime
  trip.destinationArrivalTime = trip.stopTimings.slice(-1)[0].arrivalTime
  trip.operationDays = operationDay
  trip.hasBeenTrimmed = true
  delete trip._id

  let key = {
    mode: 'tram',
    operationDays: operationDay,
    routeGTFSID: trip.routeGTFSID,
    origin: trip.origin,
    departureTime: trip.departureTime,
    destination: trip.destination,
    destinationArrivalTime: trip.destinationArrivalTime
  }

  await db.getCollection('live timetables').replaceDocument(key, trip, {
    upsert: true
  })
}

module.exports.trimFromDestination = async function(db, destination, coreRoute, trip, operationDay) {
  let cutoffStop
  let stops = db.getCollection('stops')

  if (destination === 'Abbotsford St Intg') destination = 'Royal Childrens Hospital'
  let coreDestination = utils.expandStopName(utils.adjustStopName(destination.replace(/ - .*/, '').trim()))
  if (coreDestination === 'St. Kilda Road') coreDestination = 'Flinders Street Railway Station'

  let selectionMethod = coreDestination.includes('&')
  let baseDestination = coreDestination.replace(/&.*/, '').trim()

  if (coreRoute === '70' && coreDestination === 'Wattle Park') return trip

  await async.forEachOf(trip.stopTimings, async (stop, i) => {
    if (!cutoffStop) {
      let stopData = await getStopData(stop.stopGTFSID, stops)
      let tramTrackerNames = stopData.bays.map(bay => bay.tramTrackerName).filter(Boolean)

      if (tramTrackerNames) {
        let matched = selectionMethod ? tramTrackerNames.some(name => name.includes(baseDestination))
          : tramTrackerNames.find(name => distance(name, coreDestination) <= 2)

        if (matched) {
          cutoffStop = stop.stopGTFSID
        }
      }
    }
  })

  let tripDestinationStop = trip.stopTimings.slice(-1)[0].stopGTFSID
  let indexes = trip.stopTimings.map(stop => stop.stopGTFSID)

  if (cutoffStop && tripDestinationStop !== cutoffStop) {
    let cutoffStopIndex = indexes.indexOf(cutoffStop)
    if (trip.stopTimings.length - cutoffStopIndex <= 2) return
    let hasSeen = false

    trip.stopTimings = trip.stopTimings.filter(stop => {
      if (hasSeen) return false
      if (stop.stopGTFSID === cutoffStop) {
        return hasSeen = true
      }
      return true
    })

    await modifyTrip(db, trip, operationDay)
  }

  return trip
}


module.exports.trimFromMessage = async function(db, destinations, currentStopGTFSID, trip, operationDay) {
  let stops = db.getCollection('stops')
  let indexes = []
  let destinationsFound

  await async.forEachOf(trip.stopTimings, async (stop, i) => {
    let stopData = await getStopData(stop.stopGTFSID, stops)
    let tramTrackerNames = stopData.bays.map(bay => bay.tramTrackerName).filter(Boolean)

    if (tramTrackerNames) {
      let destination = destinations.find(dest => {
        if (tramTrackerNames.includes(dest)) return true

        return tramTrackerNames.find(name => distance(name, dest) <= 3)
      })

      if (destination) {
        indexes.push(i)
        destinationsFound = destination
      }
    }
  })

  if (indexes.length === 0) {
    return null
  } else if (indexes.length === 1) {
    let missingDestination = destinations.find(dest => destinationsFound !== dest)
    let bestDestination = closest(missingDestination, knownDestinations)
    let stopNames = tramDestinationLookup[bestDestination]
    trip.stopTimings.forEach((stop, i) => {
      let stopDestinationName = utils.getDestinationName(stop.stopName)
      if (stopNames.includes(stopDestinationName)) indexes.push(i)
    })
  }

  if (indexes.length === 1) return null

  let sortedIndexes = indexes.sort()

  let currentStopData = trip.stopTimings.find(stop => stop.stopGTFSID === currentStopGTFSID)
  let currentIndex = trip.stopTimings.indexOf(currentStopData)

  // We have passed the bus zone, so its behind us, cut origin
  // Equal because if we are heading in (destination) TT wouldnt return it
  if (currentIndex >= sortedIndexes[1]) {
    trip.stopTimings = trip.stopTimings.slice(sortedIndexes[1])
  } else { // Cut destination
    trip.stopTimings = trip.stopTimings.slice(0, sortedIndexes[0] + 1)
  }

  await modifyTrip(db, trip, operationDay)

  return trip
}
