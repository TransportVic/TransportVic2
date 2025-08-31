import { MongoDatabaseConnection } from '@transportme/database'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import utils from '../../utils.js'
import urls from '../../urls.json' with { type: 'json' }
import config from '../../config.json' with { type: 'json' }
import stationCodes from '../../additional-data/station-codes.json' with { type: 'json' }
import getTripID from '../../modules/new-tracker/metro-rail-bus/get-trip-id.mjs'

let stationCodeLookup = {}

Object.keys(stationCodes).forEach(stationCode => {
  stationCodeLookup[stationCodes[stationCode]] = stationCode
})

let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()
let timetables = await database.getCollection('gtfs timetables')

let stoppingPatterns = JSON.parse(await utils.request(urls.metroRRBIndex)).stopping_patterns

let stopFrequency = {}
let patterns = {}
let patternsAtStop = {}

if (!stoppingPatterns.length) {
  let allTrips = await timetables.findDocuments({ mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, routeGTFSID: '2-RRB' }).toArray()
  let patterns = {}
  for (let trip of allTrips) {
    let pattern = trip.stopTimings.map(stop => stationCodeLookup[stop.stopName.slice(0, -16)])
    let patternID = pattern.join('-')
    if (patterns[patternID]) continue
    patterns[patternID] = {
      id: patternID,
      stops: pattern
    }
  }
  stoppingPatterns = Object.values(patterns)
}

for (let pattern of stoppingPatterns) {
  patterns[pattern.id] = pattern
  pattern.seen = false

  for (let stop of pattern.stops) {
    if (!stopFrequency[stop]) {
      stopFrequency[stop] = 0
      patternsAtStop[stop] = []
    }

    stopFrequency[stop]++
    patternsAtStop[stop].push(pattern)
  }
}

let lookupStops = []

for (let pattern of stoppingPatterns) {
  if (pattern.seen) continue
  let bestStop = pattern.stops[0]

  for (let stop of pattern.stops) {
    if (stopFrequency[stop] > stopFrequency[bestStop]) bestStop = stop
  }

  lookupStops.push(bestStop)
  patternsAtStop[bestStop].forEach(pattern => pattern.seen = true)
}

let patternCodes = {}
let allTripsGroups = []

for (let stop of lookupStops) {
  let stopData = JSON.parse(await utils.request(urls.metroRRBStopData.format(stop)))
  allTripsGroups.push(...stopData.map(stopData => ({ stopCode: stop, ...stopData })))

  for (let pattern of stopData.filter(pattern => !!pattern.route_code)) {
    let code = pattern.route_code
    let parts
    if (parts = code.match(/^\d*([A-Z]+\d*)[A-Z]?/)) code = parts[1]

    if (!patternCodes[code]) patternCodes[code] = []
    patternCodes[code].push(...pattern.trips)
  }
}

let today = utils.now().format('YYYY-MM-DD')
let tripsToday = allTripsGroups.filter(group => group.timetable === today)
let tripUpdates = Object.values(tripsToday.flatMap(group => group.trips.map((tripID, i) => ({
  stopGTFSID: `vic:rail:${group.stopCode}`,
  departureTimeMinutes: group.times[i] / 60,
  tripID,
}))).reduce((acc, e) => {
  acc[e.tripID] = e
  return acc
}, {}))

let allTripIDs = Object.keys(patternCodes).flatMap(code => patternCodes[code])
let matchedTripIDs = await timetables.distinct('tripID', {
  mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain,
  routeGTFSID: '2-RRB',
  tripID: { $in: allTripIDs }
})
let matchedTripIDsSet = new Set(matchedTripIDs)
let tripsNeedingUpdate = tripUpdates.filter(trip => !matchedTripIDsSet.has(trip.tripID))

if (tripsNeedingUpdate.length) {
  await timetables.bulkWrite(tripsNeedingUpdate.map(trip => ({
    updateOne: {
      filter: {
        mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain,
        routeGTFSID: { $ne: '2-RRB' },
        isRailReplacementBus: true,
        stopTimings: {
          $elemMatch: {
            stopGTFSID: trip.stopGTFSID,
            departureTimeMinutes: trip.departureTimeMinutes
          }
        }
      },
      update: {
        $set: {
          routeGTFSID: '2-RRB',
          runID: getTripID(trip.tripID)
        }
      }
    }
  })))
}

let bulkWrite = Object.keys(patternCodes).map(code => ({
  updateMany: {
    filter: {
      mode: GTFS_CONSTANTS.TRANSIT_MODES.metroTrain,
      routeGTFSID: '2-RRB',
      tripID: { $in: patternCodes[code] }
    },
    update: {
      $set: {
        headsign: code
      }
    }
  }
}))

if (bulkWrite.length) {
  await timetables.bulkWrite(bulkWrite)
}

process.exit(0)