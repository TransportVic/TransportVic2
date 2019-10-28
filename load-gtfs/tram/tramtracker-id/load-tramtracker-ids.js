const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')
const utils = require('../../../utils')
const fs = require('fs')
const async = require('async')
const tramtrackerStops = require('./tramtracker-stops')
const levenshtein = require('fast-levenshtein').get
const updateStats = require('../../utils/gtfs-stats')
const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops
let start = new Date()

async function matchTramStop(tramtrackerStopName, stopNumber, services, suburb) {
  let stopsMatched = await stops.findDocuments({
    $and: [
      {
        $or: [
          { suburb },
          {
            bays: {
              $elemMatch: {
                $and: [{
                  $or: [
                    { 'flags.tramtrackerName': tramtrackerStopName },
                    { stopNumber },
                    { routes: services }
                  ]
                }, { mode: 'tram' }]
              }
            }
          }
        ]
      },
      {
        bays: {
          $elemMatch: { mode: 'tram' }
        }
      }
    ]
  }, { codedSuburb: 0, codedName: 0, codedNames: 0, location: 0, mergeName: 0, stopName: 0 }).toArray()

  let bestStop = stopsMatched.map(stop => {
    let score = 0
    let stopTramtrackerName = stop.bays.filter(b => b.mode === 'tram')[0].flags.tramtrackerName.toLowerCase()
    let stopNumbers = stop.bays.filter(b => b.mode === 'tram').map(b => b.stopNumber)
      .filter(Boolean).map(e => e.replace(/^D/, ''))
    let stopServices = stop.bays.filter(b => b.mode === 'tram').map(b => b.flags.services)
      .reduce((a,e) => a.concat(e),[]).filter((e, i, a) => a.indexOf(e) === i)
      .map(v => v === '3/3a' ? '3-3a' : v)

    if (stopTramtrackerName === tramtrackerStopName.toLowerCase()) score += 3
    if (stopNumbers.includes(stopNumber.replace(/^D/, ''))) score += 3
    else score -= 1

    if (stopServices.every(svc => services.includes(svc))) score += 3
    else score -= 1

    if (stop.suburb.includes(suburb)) score += 3

    stop.nameDistance = levenshtein(tramtrackerStopName.toLowerCase(), stopTramtrackerName)
    stop.score = score

    return stop
  }).sort((a, b) => b.score - a.score || a.nameDistance - b.nameDistance)[0]

  return bestStop
}

/*
Known tram stops to ignore:
Waterfront City #11 - 7099, 8008
East Preston Tram Depot #46 - 1846, 2846
*/
let ignore = [7099, 8008, 1846, 2846]

database.connect({}, async err => {
  stops = database.getCollection('stops')
  let filteredTramtrackerStops = tramtrackerStops.filter(stop => {
    return !ignore.includes(stop.tramTrackerID)
  })

  let tramTrackerIDMap = {}
  let objectIDMap = {}

  await async.forEach(filteredTramtrackerStops, async stop => {
    let tramtrackerName = utils.adjustStopname(stop.stopName.trim()).replace(/Gve?/, 'Gr')
    let matchedStop = await matchTramStop(tramtrackerName, stop.stopNumber, stop.services, stop.suburb)

    // keep for showoff maybe
    // let matchedName = matchedStop.stopName.split('/')[0].toLowerCase()
    // if (!(matchedName.includes(tramtrackerName.toLowerCase()) || tramtrackerName.toLowerCase().includes(matchedName)))
    //   console.log(matchedStop.bays.filter(e=>e.mode==='tram'), stop)

    if (!tramTrackerIDMap[matchedStop._id]) tramTrackerIDMap[matchedStop._id] = []
      tramTrackerIDMap[matchedStop._id] = tramTrackerIDMap[matchedStop._id].concat(stop.tramTrackerID)

    objectIDMap[matchedStop._id] = matchedStop._id
  })

  console.log('Finished mapping of tramtracker ids to stops, loading it in now')

  await async.forEach(Object.keys(tramTrackerIDMap), async id => {
    let tramTrackerIDs = tramTrackerIDMap[id].filter((e, i, a) => a.indexOf(e) === i)
    let oID = objectIDMap[id]

    await stops.updateDocument({
      _id: oID
    }, {
      $set: { tramTrackerIDs }
    })
  })

  await updateStats('tramtracker-ids', filteredTramtrackerStops.length, new Date() - start)
  console.log('Completed loading in ' + filteredTramtrackerStops.length + ' tramtracker IDs')
  process.exit()
})
