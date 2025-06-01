const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')
const utils = require('../../utils')
const ptvStops = require('./tram-stops')
const directions = require('./tram-directions')
const async = require('async')
const cheerio = require('cheerio')
const ptvOverrides = require('./ptv-overrides')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

function sleep() {
  return new Promise(resolve => {
    setTimeout(resolve, 500)
  })
}

database.connect({}, async () => {
  let stops = database.getCollection('stops')
  let routes = database.getCollection('routes')
  let gtfsTimetables = database.getCollection('gtfs timetables')

  let tramServices = (await routes.distinct('routeNumber', { mode: 'tram' })).map(e => e.match(/(\d+)/)[1])
  let count = 0

  let closedStops = []

  let tramTrackerIDs = {
    '3813': '2013'
  }

  let stopDirections = {
    '3813': [{
      service: '35',
      gtfsDirection: '0'
    }]
  }

  let stopNames = {
    '3813': 'Bourke St/Spring St #0'
  }

  let stopNumbers = {
    '3813': '0'
  }

  let levelAccess = {
    '3813': false
  }

  await async.forEachSeries(tramServices, async service => {
    let routeDirections = [0, 1]
    if (service === '35') routeDirections = [0]
    await async.forEachSeries(routeDirections, async direction => {
      try {
        let data = await utils.request(`https://yarratrams.com.au/data/routestopsdata/?id=${service}&dir=${direction}`, {
          timeout: 12000
        })
        let $ = cheerio.load(data)

        let stops = Array.from($('table.route-view tbody > tr:not(.suburb):not(.suburb-section-first):not(.suburb-section):not([style])'))
        stops.forEach(stop => {
          let tramTrackerID = $('.stopid', stop).text()
          let stopNumber = $('.stopno', stop).text().toUpperCase()
          let tramTrackerName = utils.expandStopName(utils.adjustStopName($('.location', stop).text().trim()))
          let isLevelAccess = $('.stop-platform', stop).length === 1
          let url = $('a', stop).attr('href')

          if (closedStops.includes(tramTrackerID)) return

          let stopID
          if (url) stopID = url.match(/stopId=(\d+)/)[1]
          if (!tramTrackerID) return
          if (ptvOverrides[tramTrackerID]) stopID = ptvOverrides[tramTrackerID]
          if (!stopID) return

          tramTrackerIDs[tramTrackerID] = stopID
          stopNames[tramTrackerID] = tramTrackerName
          stopNumbers[tramTrackerID] = stopNumber
          levelAccess[tramTrackerID] = isLevelAccess

          if (!stopDirections[tramTrackerID]) stopDirections[tramTrackerID] = []

          stopDirections[tramTrackerID].push({
            service: service,
            gtfsDirection: parseInt(directions[`${service}.${direction}`])
          })
        })

        await sleep()
      } catch (e) {
        console.log(e)
        console.log('Failed to load stops for Route', service, 'D', direction)
      }
    })
  })

  await async.forEachSeries(Object.keys(tramTrackerIDs), async tramTrackerID => {
    let stopID = tramTrackerIDs[tramTrackerID]
    let ptvStop = ptvStops.find(stop => stop.stopID === stopID)
    let dbStop

    if (ptvStop) {
      dbStop = await stops.findDocument({
        'bays.originalName': new RegExp('^' + ptvStop.stopName),
        'bays.stopNumber': ptvStop.stopNumber.toUpperCase()
      })
    }

    if (!dbStop) {
      dbStop = await stops.findDocument({
        'bays.originalName': new RegExp(utils.adjustStopName(stopNames[tramTrackerID].split(/ ?[&\-,] ?/)[0].trim()), 'i'),
        'bays.stopNumber': stopNumbers[tramTrackerID]
      })
    }

    if (dbStop) {
      let stopGTFSIDs = dbStop.bays.filter(b => b.mode === 'tram').map(b => b.stopGTFSID)

      let matches = stopGTFSIDs.map(id => [id, 0])

      await async.forEach(stopDirections[tramTrackerID], async stopService => {
        let timetable = await gtfsTimetables.findDocument({
          mode: 'tram',
          routeGTFSID: '3-' + stopService.service,
          gtfsDirection: stopService.gtfsDirection,
          'stopTimings.stopGTFSID': {
            $in: stopGTFSIDs
          }
        })

        if (timetable) {
          let stopTiming = timetable.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))
          matches.find(m => m[0] === stopTiming.stopGTFSID)[1]++
        }
      })

      let bestMatch = matches.sort((a, b) => b[1] - a[1])[0]
      if (!bestMatch) console.log(dbStop)
      if (bestMatch[1] > 0) {
        let stopGTFSID = bestMatch[0]
        dbStop.bays = dbStop.bays.map(bay => {
          if (bay.mode === 'tram' && bay.stopGTFSID === stopGTFSID) {
            bay.tramTrackerID = tramTrackerID
            bay.tramTrackerName = stopNames[tramTrackerID]
            bay.levelAccess = levelAccess[tramTrackerID]
          }

          return bay
        })

        await stops.updateDocument({ _id: dbStop._id }, {
          $set: {
            bays: dbStop.bays
          }
        })

        return count++
      }
    }

    if (dbStop) delete dbStop.textQuery
    console.log('Failed to map stop ID', stopID, '- TT', tramTrackerID, stopNames[tramTrackerID], stopDirections[tramTrackerID], dbStop, ptvStop)
  })

  console.log('Completed loading in ' + count + ' tramtracker IDs using new method')
  process.exit()
})
