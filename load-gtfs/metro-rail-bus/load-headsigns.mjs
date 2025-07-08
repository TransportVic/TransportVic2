import { MongoDatabaseConnection } from '@transportme/database'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import utils from '../../utils.js'
import urls from '../../urls.json' with { type: 'json' }
import config from '../../config.json' with { type: 'json' }

let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()
let timetables = await database.getCollection('gtfs timetables')

let stoppingPatterns = JSON.parse(await utils.request(urls.metroRRBIndex)).stopping_patterns

let stopFrequency = {}
let patterns = {}
let patternsAtStop = {}

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

for (let stop of lookupStops) {
  let stopData = JSON.parse(await utils.request(urls.metroRRBStopData.format(stop)))
  
  for (let pattern of stopData) {
    let code = pattern.route_code
    let parts
    if (parts = code.match(/^\d*([A-Z]+\d*)[A-Z]?/)) code = parts[1]

    if (!patternCodes[code]) patternCodes[code] = []
    patternCodes[code].push(...pattern.trips)
  }
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