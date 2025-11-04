import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }
import utils from '../utils.js'
import depots from '../transportvic-data/excel/bus/depots/bus-depots.json' with { type: 'json' }
import path from 'path'
import fs from 'fs/promises'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const depotFile = path.join(__dirname, '..', 'additional-data', 'bus-tracker', 'depot-allocations.json')

const today = utils.now().startOf('day')
const threshold = 14
const days = Array(threshold).fill(0).map((_, i) => utils.getYYYYMMDD(today.clone().add(-i, 'days')))

const sort = (obj) => Object.keys(obj).sort()
  .reduce((acc, c) => { acc[c] = obj[c]; return acc }, {})

const database = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
await database.connect()

const busTrips = await database.getCollection('bus trips')
const busRegos = await database.getCollection('bus regos')
const activeBuses = await busTrips.distinct('consist', { date: { $in: days } })
const allBuses = (await busRegos.findDocuments({ rego: { $in: activeBuses } }, { rego: 1, fleetNumber: 1 }).toArray()).reduce((acc, bus) => ({
  ...acc, [bus.rego]: bus.fleetNumber
}), {})

const busDepots = {}

for (const rego of activeBuses) {
  const runIDCounts = await busTrips.aggregate([
    { $match: {
      date: { $in: days },
      consist: rego
    } },
    { $group: { _id: '$runID', count: { $sum: 1 } } }
  ]).toArray()

  const depotCounts = runIDCounts
    .map(({ _id, count }) => ({ depot: _id.slice(0, 2), count }))
    .reduce((acc, { depot, count }) => ({
      ...acc,
      [depot]: (acc[depot] || 0) + count
  }), {})

  const mostCommonDepot = Object.keys(depotCounts).reduce(
    (curMax, newDepot) => depotCounts[newDepot] > depotCounts[curMax] ? newDepot : curMax
  )

  busDepots[allBuses[rego]] = depots[mostCommonDepot]
}

const existingData = await (async () => { try { return JSON.parse(await fs.readFile(depotFile)) } catch (e) { return {} } })()
await fs.writeFile(depotFile, JSON.stringify(sort({
  ...existingData,
  ...busDepots
}), null, 2))

console.log(busDepots)

database.close()
process.exit(0)