const async = require('async')
const utils = require('../../utils')
const TimedCache = require('../../TimedCache')
const EventEmitter = require('events')
const tramDestinations = require('../../additional-data/tram-destinations')
const { closest } = require('fastest-levenshtein')

let tramDestinationLookup = {}
Object.keys(tramDestinations).forEach(dest => {
  let humanName = tramDestinations[dest]
  if (!tramDestinationLookup[humanName]) tramDestinationLookup[humanName] = []
  tramDestinationLookup[humanName].push(dest)
})
let knownDestinations = Object.keys(tramDestinationLookup)

let stopsCache = {}
let stopsLocks = {}

async function getStopData(stopGTFSID, stops) {
  if (stopsCache[stopGTFSID]) return stopsCache[stopGTFSID]
  if (stopsLocks[stopGTFSID]) {
    return await new Promise(resolve => stopsLocks[stopGTFSID].on('loaded', resolve))
  }
  stopsLocks[stopGTFSID] = new EventEmitter()
  stopsLocks[stopGTFSID].setMaxListeners(30)
  let stopData = await stops.findDocument({ 'bays.stopGTFSID': stopGTFSID })

  stopsCache[stopGTFSID] = stopData
  stopsLocks[stopGTFSID].emit('loaded', stopData)
  delete stopsLocks[stopGTFSID]

  return stopData
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

  let selectionMethod = destination.includes('&')
  let baseDestination = destination.replace(/&.*/, '').trim()

  if (coreRoute === '70' && destination === 'Wattle Park') return trip

  await async.forEachOf(trip.stopTimings, async (stop, i) => {
    if (!cutoffStop) {
      let stopData = await getStopData(stop.stopGTFSID, stops)
      if (stopData.tramTrackerNames) {
        let matched = selectionMethod ? stopData.tramTrackerNames.some(name => name.includes(baseDestination))
          : stopData.tramTrackerNames.includes(baseDestination)
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
    if (stopData.tramTrackerNames) {
      let destination = destinations.find(dest => stopData.tramTrackerNames.includes(dest))
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
