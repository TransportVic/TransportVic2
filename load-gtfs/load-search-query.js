const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')
const async = require('async')

const updateStats = require('./utils/stats')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let start = new Date()

database.connect({}, async err => {
  let stops = database.getCollection('stops')

  let stopIDs = await stops.distinct('_id')
  let stopCount = stopIDs.length

  let bayCount = 0

  await async.forEachOfLimit(stopIDs, 100, async (id, i) => {
    let stop = await stops.findDocument({ _id: id })

    let bayNames = stop.bays.map(bay => bay.fullStopName)
    let originalNames = stop.bays.map(bay => bay.originalName)

    let textQuery = [
      ...bayNames.map(name => utils.tokeniseAndSubstring(name)),
      ...originalNames.map(name => utils.tokeniseAndSubstring(name)),
      ...stop.suburb.map(name => utils.tokeniseAndSubstring(name)),
      ...(stop.tramTrackerNames || []).map(name => utils.tokeniseAndSubstring(name))
    ].reduce((a, e) => a.concat(e), []).filter((e, i, a) => a.indexOf(e) === i)

    await stops.updateDocument({ _id: id }, {
      $set: {
        textQuery
      }
    })

    if (i % 2000 === 0) {
      console.log('Stop Query: Completed ' + (i / stopCount * 100).toFixed(2) + '% of stops')
    }
  })

  await updateStats('stop-query', stopIDs.length)
  console.log('Completed loading in text query for ' + stopIDs.length + ' stops')
  process.exit()
})
