import { MongoDatabaseConnection } from '@transportme/database'
import config from '../config.json' with { type: 'json' }
import utils from '../utils.mjs'
import depots from '../transportvic-data/excel/bus/depots/bus-depots.json' with { type: 'json' }
import path from 'path'
import fs from 'fs/promises'
import url from 'url'
import manualOverrides from '../additional-data/bus-tracker/manual-overrides.json' with { type: 'json' }

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const depotFile = path.join(__dirname, '..', 'additional-data', 'bus-tracker', 'depot-allocations.json')

const today = utils.now().startOf('day')
const threshold = 7
const days = Array(threshold).fill(0).map((_, i) => utils.getYYYYMMDD(today.clone().add(-i, 'days')))

const sort = (obj) => Object.keys(obj).sort((a, b) => {
  const [_, op1, fl1] = a.match(/([A-Z]+)(\d+)/)
  const [__, op2, fl2] = b.match(/([A-Z]+)(\d+)/)
  return op1.localeCompare(op2) || (parseInt(fl1) - parseInt(fl2))
}).reduce((acc, c) => { acc[c] = obj[c]; return acc }, {})

const ORBITAL_ROUTES = ['901', '902', '903']

const database = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
await database.connect()

const busTrips = await database.getCollection('bus trips')
const busRegos = await database.getCollection('bus regos')
const activeBuses = await busTrips.distinct('consist', { date: { $in: days } })

const allBuses = (await busRegos.findDocuments({ rego: { $in: activeBuses } }, { rego: 1, fleetNumber: 1 }).toArray()).reduce((acc, bus) => ({
  ...acc, [bus.rego]: bus.fleetNumber
}), {})

const busDepots = {}
const existingData = await (async () => { try { return JSON.parse(await fs.readFile(depotFile)) } catch (e) { return {} } })()

const busesToCheck = activeBuses
  .filter(bus => allBuses[bus])
  .filter(bus => !['V', 'K'].includes(allBuses[bus][0]))

for (const rego of busesToCheck) {
  const runIDCounts = await busTrips.aggregate([
    { $match: {
      date: { $in: days },
      consist: rego
    } },
    { $group: { _id: '$runID', count: { $sum: 1 } } }
  ]).toArray()

  const serviceCounts = (await busTrips.aggregate([
    { $match: {
      date: { $in: days },
      consist: rego
    } },
    { $group: { _id: '$routeNumber', count: { $sum: 1 } } }
  ]).toArray()).reduce((acc, { _id, count }) => ({
    ...acc, [_id]: count
  }), {})

  const tripsRun = runIDCounts.reduce((acc, { count }) => acc + count, 0)

  const depotCounts = runIDCounts
    .map(({ _id, count }) => ({ depot: _id.slice(0, 2), count }))
    .reduce((acc, { depot, count }) => ({
      ...acc,
      [depot]: (acc[depot] || 0) + count
  }), {})

  const depotIDs = Object.keys(depotCounts)
  const mostCommonDepot = depotIDs.reduce(
    (curMax, newDepot) => depotCounts[newDepot] > depotCounts[curMax] ? newDepot : curMax
  )

  let mostCommonDepotName = depots[mostCommonDepot]

  // Kinetic bus based out of 3 or more depots, likely an Orbital
  if (allBuses[rego][0] === 'K') {
    const orbitalsRun = ORBITAL_ROUTES.reduce((acc, route) => acc + (serviceCounts[route] || 0), 0)
    const nonOrbitalsRun = tripsRun - orbitalsRun
    const multiDepot = depotIDs.length >= 2 && orbitalsRun >= 5
    const singleDepotOrbital = orbitalsRun > 5 || (nonOrbitalsRun <= 2 && orbitalsRun >= 1)
    const isOrbital = multiDepot || singleDepotOrbital

    if (!isOrbital && existingData[rego] === 'Kinetic (Orbital)' && tripsRun < 5) continue
    else if (isOrbital) mostCommonDepotName = 'Kinetic (Orbital)'
  }

  busDepots[allBuses[rego]] = mostCommonDepotName
}

await fs.writeFile(depotFile, JSON.stringify(sort({
  ...existingData,
  ...busDepots,
  ...manualOverrides
}), null, 2))

database.close()
process.exit(0)