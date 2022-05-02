const async = require('async')
const config = require('../../config')
const modules = require('../../modules')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils')
const stops = require('../../additional-data/tram-tracker/stops')
const getDepartures = require('../../modules/tram/get-departures')
const scheduleIntervals = require('./schedule-intervals')

let database
let dbStops

function pickRandomStops() {
  let stopSize = scheduleIntervals([
    [0, 60, 10],
    [270, 1200, 20],
    [1201, 1439, 10]
  ])

  return utils.shuffle(stops).slice(0, stopSize)
}

async function requestTimings() {
  let stops = pickRandomStops()

  try {
    await async.forEachSeries(stops, async (stop, i) => {
      global.loggers.trackers.tram.info('requesting timings for', stop)
      let [codedSuburb, codedName] = stop.split('/')
      let dbStop = await dbStops.findDocument({ codedName, codedSuburb })
      if (!dbStop) return global.loggers.trackers.tram.err('could not find', stop)

      await getDepartures(dbStop, database)
      await utils.sleep(5000)
    })
  } catch (e) {
    global.loggers.trackers.tram.err('Failed to get tram trips this round', e)
  }
}

if (modules.tracker && modules.tracker.tram) {
  database = new DatabaseConnection(config.databaseURL, config.databaseName)
  database.connect(async () => {
    dbStops = database.getCollection('stops')
    await requestTimings()
    process.exit()
  })
} else process.exit()
