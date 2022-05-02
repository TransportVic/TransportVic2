const async = require('async')
const config = require('../../config')
const modules = require('../../modules')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils')
const stops = require('../../additional-data/bus-tracker/stops')
const nightStops = require('../../additional-data/bus-tracker/night-stops')
const getDepartures = require('../../modules/bus/get-departures')
const scheduleIntervals = require('./schedule-intervals')

let database
let dbStops

function isNightNetwork() {
  let minutes = utils.getMinutesPastMidnightNow()

  return minutes > 60 && minutes <= 300 // 0100 - 0500
}

function pickRandomStops() {
  let stopSize = scheduleIntervals([
    [0, 60, 23],
    [60, 299, 25],
    [300, 1260, 29],
    [1261, 1440, 27]
  ])

  stopSize = 3 // Until PTV fixes the API

  return utils.shuffle(isNightNetwork() ? nightStops : stops).slice(0, stopSize)
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
      let [codedSuburb, codedName] = stop.split('/')
      let dbStop = await dbStops.findDocument({ codedName, codedSuburb })
      if (!dbStop) return global.loggers.trackers.bus.err('could not find', stop)

      global.loggers.trackers.bus.info('requesting timings for', stop)
      await getDepartures(dbStop, database)

      await utils.sleep(5000)
    })
  } catch (e) {
    global.loggers.trackers.bus.err('Failed to get bus trips this round', e)
  }
}

if (modules.tracker && modules.tracker.bus) {
  database = new DatabaseConnection(config.databaseURL, config.databaseName)
  database.connect(async () => {
    dbStops = database.getCollection('stops')
    await requestTimings()

    process.exit()
  })
} else process.exit()
