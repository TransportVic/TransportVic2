const config = require('../../config')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils.mjs')
const stops = require('../../additional-data/bus-tracker/stops')
const nightStops = require('../../additional-data/bus-tracker/night-stops')
const async = require('async')
const getDepartures = require('../../modules/bus/get-departures')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops

function isNightNetwork() {
  let minutes = utils.getMinutesPastMidnightNow()

  return minutes > 60 && minutes <= 300 // 0100 - 0500
}

function pickRandomStops() {
  if (isNightNetwork()) {
    return utils.shuffle(nightStops).slice(0, 3) //29
  } else {
    return utils.shuffle(stops).slice(0, 3) //28
  }
}

function shouldRun() {
  let minutes = utils.getMinutesPastMidnightNow()
  let dayOfWeek = utils.getDayOfWeek(utils.now())

  if (minutes >= 240 || minutes <= 60) return true // from 4am to 1am (next day)

  if (['Sat', 'Sun'].includes(dayOfWeek)) { // Considering the true day, NN runs on sat & sun morn
    return minutes < 240 // 2359 - 0459
  }

  return false
}

async function requestTimings() {
  if (!shouldRun()) return

  let stops = pickRandomStops()

  try {
    await async.forEachSeries(stops, async stop => {
      let [cleanSuburbs, cleanName] = stop.split('/')
      let dbStop = await dbStops.findDocument({ cleanName, cleanSuburbs })
      if (!dbStop) return global.loggers.oldTrackers.bus.err('could not find', stop)

      try {
        global.loggers.oldTrackers.bus.info('requesting timings for', stop)
        await getDepartures(dbStop, database)
        await utils.sleep(5000)
      } catch (e) {
        global.loggers.oldTrackers.bus.err('Failed to get bus trips at', stop, e)
      }
    })
  } catch (e) {
    global.loggers.oldTrackers.bus.err('Failed to get bus trips this round', e)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  schedule([
    [300, 1260, 10]
    // [0, 60, 6.5],
    // [60, 299, 6],
    // [300, 1260, 5],
    // [1261, 1440, 6]
  ], requestTimings, 'bus tracker', global.loggers.oldTrackers.bus)
})
