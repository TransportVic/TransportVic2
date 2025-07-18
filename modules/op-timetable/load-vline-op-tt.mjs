import { MongoDatabaseConnection } from '@transportme/database'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'
import { convertToLive } from '../departures/sch-to-live.js'
import config from '../../config.json' with { type: 'json' }
import { PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

async function getStopFromVNetName(stops, vnetName) {
  return await stops.findDocument({
    'bays.vnetStationName': vnetName
  })
}

export async function matchTrip(operationDay, vlineTrip, db) {
  let gtfsTimetables = await db.getCollection('gtfs timetables')
  let stops = await db.getCollection('stops')

  let originStop = await getStopFromVNetName(stops, vlineTrip.origin)
  let destinationStop = await getStopFromVNetName(stops, vlineTrip.destination)

  if (!originStop || !destinationStop) return null

  return await gtfsTimetables.findDocument({
    mode: GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain,
    operationDays: operationDay,
    origin: originStop.stopName,
    destination: destinationStop.stopName,
    departureTime: utils.formatPTHHMM(utils.parseTime(vlineTrip.departureTime.toUTC().toISO())),
    destinationArrivalTime: utils.formatPTHHMM(utils.parseTime(vlineTrip.arrivalTime.toUTC().toISO())),
  })
}

export default async function loadOperationalTT(db, operationDay, ptvAPI) {
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
