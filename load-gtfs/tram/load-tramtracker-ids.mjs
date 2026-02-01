import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'
import ptvStops from './tram-stops.json' with { type: 'json' }
import directions from './tram-directions.mjs'
import async from 'async'
import { load as loadHTML } from 'cheerio'
import ptvOverrides from './ptv-overrides.mjs'
import baseTTIDs from '../../transportvic-data/tram/tramtracker-ids.mjs'

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)

await database.connect({})

let stops = database.getCollection('gtfs-stops')
let routes = database.getCollection('gtfs-routes')
let gtfsTimetables = database.getCollection('gtfs-gtfs timetables')

await stops.bulkWrite(Object.keys(baseTTIDs).map(stopGTFSID => ({
  updateOne: {
    filter: {
      bays: { $elemMatch: {
        mode: 'tram',
        stopGTFSID
      } }
    },
    update: {
      $set: {
        'bays.$.tramTrackerID': baseTTIDs[stopGTFSID].tramTrackerID,
        'bays.$.tramTrackerName': baseTTIDs[stopGTFSID].tramTrackerName,
        'bays.$.levelAccess': baseTTIDs[stopGTFSID].levelAccess
      }
    }
  }
})))

let tramServices = await routes.distinct('routeNumber', { mode: 'tram' })
let count = 0

let closedStops = []

const manualTrackerIDs = {
  3813: 2013, // Spring Street
}

let tramTrackerIDs = { ...manualTrackerIDs }

let stopDirections = {
  '3813': [{
    service: '35',
    gtfsDirection: 0
  }]
}

let stopNames = {
  '3813': 'Spring St & Bourke St'
}

let stopNumbers = {
  '3813': '0',
  '3697': 'D3'
}

let levelAccess = {
  '3813': false,
  '3697': true
}

for (let service of tramServices) {
  let routeDirections = [0, 1]
  if (service === '35') routeDirections = [0]
  for (let direction of routeDirections) {
    try {
      let data = await utils.request(`https://yarratrams.com.au/data/routestopsdata/?id=${service}&dir=${direction}`, {
        timeout: 12000
      })
      let $ = loadHTML(data)

      let stops = Array.from($('table.route-view tbody > tr:not(.suburb):not(.suburb-section-first):not(.suburb-section):not([style])'))
      stops.forEach(stop => {
        let tramTrackerID = $('.stopid', stop).text()
        let stopNumber = $('.stopno', stop).text().toUpperCase()
        let tramTrackerName = utils.expandStopName(utils.adjustStopName($('.location', stop).text().trim().split('\n')[1].trim()))
        let isLevelAccess = $('.stop-platform', stop).length === 1
        let url = $('a', stop).attr('href')

        if (closedStops.includes(tramTrackerID)) return

        let stopID
        if (url) stopID = url.match(/stopId=(\d+)/)[1]
        if (!tramTrackerID) return
        if (ptvOverrides[tramTrackerID]) stopID = ptvOverrides[tramTrackerID]
        if (!stopID) return

        tramTrackerIDs[tramTrackerID] = parseInt(stopID)
        stopNames[tramTrackerID] = tramTrackerName
        stopNumbers[tramTrackerID] = stopNumber
        levelAccess[tramTrackerID] = isLevelAccess

        if (!stopDirections[tramTrackerID]) stopDirections[tramTrackerID] = []

        stopDirections[tramTrackerID].push({
          service: service,
          gtfsDirection: parseInt(directions[`${service}.${direction}`])
        })
      })

      await utils.sleep(500)
    } catch (e) {
      console.log(e)
      console.log('Failed to load stops for Route', service, 'D', direction)
    }
  }
}

let sortedTramTrackerIDs = Object.keys(tramTrackerIDs).sort().reverse()

for (let tramTrackerID of sortedTramTrackerIDs) {
  let stopID = tramTrackerIDs[tramTrackerID]
  let ptvStop = ptvStops.find(stop => stop.stopID === stopID)
  let dbStop

  if (ptvStop) {
    dbStop = (await stops.findDocument({
      'bays.originalName': new RegExp('^' + ptvStop.stopName.trim()),
      'bays.stopNumber': ptvStop.stopNumber.toUpperCase()
    }, { bays: 1 })) || (await stops.findDocument({
      'bays.originalName': new RegExp(utils.adjustStopName(stopNames[tramTrackerID].split(/ ?[&\-,] ?/)[0].trim()), 'i'),
      'bays.stopNumber': stopNumbers[tramTrackerID]
    }, { bays: 1 }))
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
      }, { stopTimings: 1 })

      if (timetable) {
        let stopTiming = timetable.stopTimings.find(stop => stopGTFSIDs.includes(stop.stopGTFSID))
        matches.find(m => m[0] === stopTiming.stopGTFSID)[1]++
      }
    })

    let bestMatch = matches.sort((a, b) => b[1] - a[1])[0]
    if (!bestMatch) console.log(dbStop)
    if (bestMatch[1] > 0) {
      let stopGTFSID = bestMatch[0]
      await stops.updateDocument({ _id: dbStop._id }, {
        $set: {
          bays: dbStop.bays.map(bay => {
            if (bay.mode === 'tram' && bay.stopGTFSID === stopGTFSID) {
              bay.tramTrackerID = tramTrackerID
              bay.tramTrackerName = stopNames[tramTrackerID]
              bay.levelAccess = levelAccess[tramTrackerID]
            }

            return bay
          })
        }
      })

      count++
      if (count % 100 === 0) console.log('Completed', count, `stops (${(count / sortedTramTrackerIDs.length * 100).toFixed(1)}%)`)
      continue
    }
  }

  if (!manualTrackerIDs[tramTrackerID]) {
    console.log('Failed to map stop ID', stopID, '- TT', tramTrackerID, stopNames[tramTrackerID], stopDirections[tramTrackerID], dbStop, ptvStop)
  }
}

console.log('Completed loading in ' + count + ' tramtracker IDs using new method')

const missingTTIDs = await stops.distinct('stopName', {
  bays: {
    $elemMatch: {
      mode: 'tram',
      tramTrackerID: { $exists: false }
    }
  }
})

if (missingTTIDs.length) console.log('Tram stops with missing TTID:', missingTTIDs)

process.exit()