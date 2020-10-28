const config = require('../../config.json')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils')
const shuffle = require('lodash.shuffle')
const stops = require('../../additional-data/tram-tracker/stops')
const async = require('async')
const getDepartures = require('../../modules/tram/get-departures-experimental')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops

function pickRandomStops() {
  return shuffle(stops).slice(0, 20)
}

async function requestTimings() {
  let stops = pickRandomStops()

  try {
    await async.forEachOf(stops, async (stop, i) => {
      global.loggers.trackers.tram.info('requesting timings for', stop)
      let [codedSuburb, codedName] = stop.split('/')
      let dbStop = await dbStops.findDocument({ codedName, codedSuburb })
      if (!dbStop) return global.loggers.trackers.tram.err('could not find', stop)

      setTimeout(async () => {
        await getDepartures(dbStop, database)
      }, i * 15000)
    })
  } catch (e) {
    global.loggers.trackers.tram.err('Failed to get tram trips this round', e)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')

  schedule([
    [0, 60, 10],
    [270, 1200, 6],
    [1201, 1439, 10]
  ], requestTimings, 'tram tracker', global.loggers.trackers.tram)
})
