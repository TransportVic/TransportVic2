import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'
import async from 'async'

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)

let start = new Date()

await database.connect({})
let stops = database.getCollection('gtfs-stops')

let stopIDs = await stops.distinct('_id')
let stopCount = stopIDs.length

await async.forEachOfLimit(stopIDs, 3000, async (id, i) => {
  let stop = await stops.findDocument({ _id: id })

  let bayNames = stop.bays.map(bay => bay.fullStopName)
  let originalNames = stop.bays.map(bay => bay.originalName)
  let tramTrackerNames = stop.bays.map(bay => bay.tramTrackerName).filter(Boolean)

  let namesForTokenisation = bayNames
    .concat(originalNames)
    .concat(tramTrackerNames)
    .concat(stop.suburb)
    .filter((e, i, a) => a.indexOf(e) === i)

  let textQuery = namesForTokenisation
    .flatMap(name => utils.tokeniseAndSubstring(name))
    .map(l => l.toLowerCase())

  await stops.updateDocument({ _id: id }, {
    $set: {
      textQuery
    }
  })

  if (i % 2000 === 0) {
    console.log('Stop Query: Completed ' + (i / stopCount * 100).toFixed(2) + '% of stops')
  }
})

console.log('Completed loading in text query for ' + stopIDs.length + ' stops')
process.exit()