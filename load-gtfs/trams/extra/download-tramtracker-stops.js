const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')
const async = require('async')
const fs = require('fs')
const path = require('path')

const updateStats = require('../../utils/stats')
const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let allStops = {}
let serviceByStops = {}

function sleep() {
  return new Promise(resolve => setTimeout(resolve, 500))
}

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')

  // let tramServices = (await routes.distinct('routeNumber', { mode: 'tram' })).map(e => e.match(/(\d+)/)[1]).concat('3a')
  let tramServices = ['3', '3a']
  let count = 0

  await async.forEachSeries(tramServices, async service => {
    await async.forEachSeries([false, true], async direction => {
      count++
      let data = await utils.request(`http://tramtracker.com/Controllers/GetStopsByRouteAndDirection.ashx?r=${service === '3a' ? '4' : service}&u=${direction}`)
      let serviceStops = JSON.parse(data).ResponseObject

      let stops = serviceStops.map(stop => {
        let stopNumber = stop.StopName.match(/(\d+\w?)/)[1]
        let stopName = stop.StopName.match(/\d+\w? ([\w ]+)/)
        let suburb = stop.Suburb
        let tramTrackerID = stop.StopNo
        if (!stopName) {
          if (tramTrackerID == 2063)
          stopName = 'Maroona Rd'
        } else stopName = stopName[1]

        stopName = stopName.replace('Road', 'Rd')

        return {stopNumber, stopName, tramTrackerID, suburb}
      })

      stops.forEach(stop => {
        allStops[JSON.stringify(stop)] = stop

        if (!serviceByStops[stop.tramTrackerID]) serviceByStops[stop.tramTrackerID] = []
        serviceByStops[stop.tramTrackerID].push(service)
      })

      if (service !== '3') {
        await new Promise(resolve => {
          fs.writeFile(path.join(__dirname, 'routes', `${service === '3a' ? '3' : service}-${direction ? 0 : 1}.json`), JSON.stringify(stops), resolve)
        })
      }
    })

    await sleep()
  })

  let stopData = Object.values(allStops)
    stopData = JSON.stringify(stopData.map(stop => {
      stop.services = serviceByStops[stop.tramTrackerID].sort((a, b) => a - b).map(e => {
        return e === '3' ? '3-3a' : e
      }).filter((e, i, a) => a.indexOf(e) === i)
      return stop
    }))

  fs.writeFile(path.join(__dirname, 'tramtracker-stops.json'), stopData, () => {
    console.log('Downloaded TramTracker data for ' + count + ' services * 2')
    updateStats('download-tramtracker-stops', count)
    process.exit()
  })
})
