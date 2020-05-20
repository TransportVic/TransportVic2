const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')
const fs = require('fs')
const async = require('async')

const updateStats = require('../../utils/stats')
const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let files = fs.readdirSync(__dirname + '/routes')
database.connect({}, async () => {
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  let count = 0

  await async.forEachSeries(files, async file => {
    let parts = file.split('-')
    let routeGTFSID = `3-${parts[0]}`

    let routeStops = JSON.parse(fs.readFileSync(__dirname + '/routes/' + file).toString())
    let startingFew = routeStops.slice(0, 3).map(s => s.stopNumber.replace(/[^\d]/g, ''))

    let gtfsRouteStops = (await routes.findDocument({ routeGTFSID })).directions.find(d => {
      return startingFew.includes(d.stops[0].stopNumber.replace(/[^\d]/g, ''))
    }).stops

    if (routeGTFSID === '3-3') {
      routeStops = routeStops.filter(e => e.stopNumber > 130)
      gtfsRouteStops = gtfsRouteStops.filter(e => e.stopNumber > 130)
    }

    let stopNumbers = routeStops.map(s => s.stopNumber.replace(/[^\d]/g, ''))

    if (Math.abs(routeStops.length - gtfsRouteStops.length) < 4) {
      let startingNumber = gtfsRouteStops[0].stopNumber.replace(/[^\d]/g, '')
      let startingIndex = stopNumbers.indexOf(startingNumber)
      let remainingStops = routeStops.slice(startingIndex)

      await async.forEachOfSeries(remainingStops, async (remainingStop, i) => {
        count++

        let gtfsStop = gtfsRouteStops[i]
        if (gtfsStop) {
          let {stopGTFSID} = gtfsStop

          let stopData = await stops.findDocument({ 'bays.stopGTFSID': stopGTFSID })
          let tramTrackerIDs = stopData.tramTrackerIDs || []

          if (!tramTrackerIDs.includes(remainingStop.tramTrackerID)) {
            tramTrackerIDs.push(remainingStop.tramTrackerID)
          }

          await stops.updateDocument({ _id: stopData._id }, {
            $set: { tramTrackerIDs }
          })
        }
      })
    }
  })

  await updateStats('tramtracker-ids-old', count)
  console.log('Completed loading in ' + count + ' tramtracker IDs using new method')
  process.exit()
})
