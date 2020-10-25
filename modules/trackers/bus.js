const config = require('../../config.json')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils')
const shuffle = require('lodash.shuffle')
const stops = require('../../additional-data/bus-tracker/stops')
const async = require('async')
const getDepartures = require('../../modules/bus/get-departures')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops

function isNight() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 1261 <= minutes && minutes <= 1439 || minutes <= 60 // 2101 - 0100
}

function pickRandomStops() {
  let size = 26
  if (isNight()) size = Math.floor(size / 2)
  return shuffle(stops).slice(0, size)
}

async function requestTimings() {
  let stops = pickRandomStops()

  try {
    await async.forEachOf(stops, async (stop, i) => {
      global.loggers.trackers.bus.info('requesting timings for', stop)
      let [codedSuburb, codedName] = stop.split('/')
      let dbStop = await dbStops.findDocument({ codedName, codedSuburb })
      if (!dbStop) return global.loggers.trackers.bus.err('could not find', stop)

      setTimeout(async () => {
        await getDepartures(dbStop, database)
      }, i * 15000)
    })
  } catch (e) {
    global.loggers.trackers.bus.err('Failed to get bus trips this round', e)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  schedule([
    [0, 60, 10],
    [300, 1260, 7],
    [1261, 1440, 10]
  ], requestTimings, 'bus tracker', global.loggers.trackers.bus)
})
