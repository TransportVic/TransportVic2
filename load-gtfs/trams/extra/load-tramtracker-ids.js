const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')
const ptvStops = require('./tram-stops.json')
const fs = require('fs')
const async = require('async')
const cheerio = require('cheerio')

const updateStats = require('../../utils/stats')
const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let files = fs.readdirSync(__dirname + '/routes')

function sleep() {
  return new Promise(resolve => {
    setTimeout(resolve, 500)
  })
}

database.connect({}, async () => {
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')

  let tramServices = (await routes.distinct('routeNumber', { mode: 'tram' })).map(e => e.match(/(\d+)/)[1]).concat('3a')
  let count = 0

  let stopIDs = {}
  let stopNames = {}
  let stopNumbers = {}

  await async.forEachSeries(tramServices, async service => {
    await async.forEachSeries([0, 1], async direction => {
      let data = await utils.request(`https://yarratrams.com.au/umbraco/surface/data/routestopsdata/?id=${service}&dir=${direction}`)
      let $ = cheerio.load(data)

      let stops = Array.from($('table.route-view tbody > tr:not(.suburb):not(.suburb-section-first):not(.suburb-section):not([style])'))
      stops.forEach(stop => {
        let tramTrackerID = $('.stopid', stop).text()
        let stopNumber = $('.stopno', stop).text().toUpperCase()
        let tramTrackerName = utils.expandStopName(utils.adjustStopname($('.location', stop).text().split(/ ?[&\-,] ?/)[0].trim()))
        let url = $('a', stop).attr('href')

        if (!url) return

        let stopID = url.match(/stopId=(\d+)/)[1]

        if (!tramTrackerID) return

        if (!stopIDs[stopID]) {
          stopIDs[stopID] = []
          stopNames[stopID] = []
          stopNumbers[stopID] = []
        }

        if (!stopIDs[stopID].includes(tramTrackerID)) stopIDs[stopID].push(tramTrackerID)
        if (!stopNames[stopID].includes(tramTrackerName)) stopNames[stopID].push(tramTrackerName)
        if (!stopNumbers[stopID].includes(stopNumber)) stopNumbers[stopID].push(stopNumber)
      })

      await sleep()
    })
  })

  await async.forEach(Object.keys(stopIDs), async stopID => {
    count++

    let ptvStop = ptvStops.find(stop => stop.stopID === stopID)
    let dbStop

    if (ptvStop) {
      dbStop = await stops.findDocument({
        'bays.fullStopName': ptvStop.stopName,
        'bays.stopNumber': {
          $in: stopNumbers[stopID]
        }
      })
    }

    if (!dbStop) {
      dbStop = await stops.findDocument({
        $or: stopNames[stopID].map(stopName => ({
          'bays.fullStopName': new RegExp(stopName, 'i'),
          'bays.stopNumber': {
            $in: stopNumbers[stopID]
          }
        }))
      })
    }

    if (dbStop) {
      await stops.updateDocument({ _id: dbStop._id }, {
        $set: {
          tramTrackerIDs: stopIDs[stopID].map(e => parseInt(e)),
          tramTrackerNames: stopNames[stopID]
        }
      })

      return
    }

    console.log('Failed to map stop', stopID, stopIDs[stopID], stopNames[stopID], dbStop)
  })

  await updateStats('tramtracker-ids', count)
  console.log('Completed loading in ' + count + ' tramtracker IDs using new method')
  process.exit()
})
