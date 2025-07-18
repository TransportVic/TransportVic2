import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'
import config from '../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'

async function loadOperationalTT(db, operationDay, ptvAPI) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))

  await loadOperationalTT(mongoDB, utils.now(), ptvAPI)

await mongoDB.close()
}
