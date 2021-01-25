const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const loadStops = require('../utils/load-stops')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let gtfsID = 5

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')

  let splicedGTFSPath = path.join(__dirname, '../spliced-gtfs-stuff', `${gtfsID}`)
  let stopsFiles = fs.readdirSync(splicedGTFSPath).filter(e => e.startsWith('stops'))

  let stopCount = 0

  await async.forEachSeries(stopsFiles, async stopFile => {
    let data = JSON.parse(fs.readFileSync(path.join(splicedGTFSPath, stopFile)))

    data.forEach(stop => {
      stop.fullStopName = utils.expandStopName(utils.adjustStopName(stop.originalName))
      stop.suburb = utils.getDistanceFromLatLon(-37.818115, 144.963237, stop.location.coordinates[1], stop.location.coordinates[0]).toFixed(0)
    })

    await loadStops(stops, data, {})
    stopCount += data.length
  })

  await updateStats('coach-stops', stopCount)
  console.log('Completed loading in ' + stopCount + ' regional coach stops')
  process.exit()
})
