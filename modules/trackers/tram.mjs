import config from '../../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import utils from '../../utils.mjs'
import stops from '../../additional-data/tram-tracker/stops.js'
import async from 'async'
import getDepartures from '../../modules/tram/get-departures.mjs'
import schedule from './scheduler.mjs'

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
const tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
let dbStops


function pickRandomStops() {
  return utils.shuffle(stops).slice(0, 20)
}

async function requestTimings() {
  let stops = pickRandomStops()

  try {
    await async.forEachSeries(stops, async stop => {
      let [cleanSuburbs, cleanName] = stop.split('/')
      let dbStop = await dbStops.findDocument({ cleanName, cleanSuburbs })
      if (!dbStop) return global.loggers.oldTrackers.tram.err('could not find', stop)

      try {
        global.loggers.oldTrackers.tram.info('requesting timings for', stop)
        await getDepartures(dbStop, database, tripDatabase)
        await utils.sleep(5000)
      } catch (e) {
        global.loggers.oldTrackers.bus.err('Failed to get tram trips at', stop, e)
      }
    })
  } catch (e) {
    global.loggers.oldTrackers.tram.err('Failed to get tram trips this round', e)
  }
}

await database.connect()
await tripDatabase.connect()
dbStops = database.getCollection('stops')

for (let stop of stops) {
  let [cleanSuburbs, cleanName] = stop.split('/')
  let dbStop = await dbStops.findDocument({ cleanName, cleanSuburbs })
  if (!dbStop) global.loggers.oldTrackers.tram.err('could not find', stop)
}

schedule([
  [0, 60, 10],
  [270, 1200, 6],
  [1201, 1439, 10]
], requestTimings, 'tram tracker', global.loggers.oldTrackers.tram)
