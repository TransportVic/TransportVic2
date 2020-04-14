const ptvAPI = require('../../ptv-api')
const async = require('async')
const moment = require('moment')
const utils = require('../../utils')

async function runHealthCheck(db) {
  let liveTimetables = db.getCollection('live timetables')
  let gtfsTimetables = db.getCollection('gtfs timetables')
  let routes = db.getCollection('routes')
  let {status, disruptions} = await ptvAPI('/v3/disruptions')
  if (status.health === 0) throw new Error('PTV down')

  liveTimetables.deleteDocuments({
    mode: 'metro train',
    type: 'suspension'
  })

  let suspensions = disruptions.metro_train.filter(disruption => {
    return disruption.disruption_type.toLowerCase().includes('suspended')
  })

  await async.forEach(suspensions, async suspension => {
    let stationsAffected = suspension.description.match(/between ([ \w]+) and ([ \w]+) stations/)
    if (!stationsAffected) return
    let startStation = stationsAffected[1].trim() + ' Railway Station',
        endStation = stationsAffected[2].trim() + ' Railway Station'
    let startMinutesPastMidnight = utils.getMinutesPastMidnight(utils.now())
    let endMinutesPastMidnight = startMinutesPastMidnight + 120
    let today = utils.getYYYYMMDDNow()

    let routeGTFSIDs = suspension.routes.map(route => route.route_gtfs_id)

    await async.forEach(routeGTFSIDs, async routeGTFSID => {
      let stops = (await routes.findDocument({ routeGTFSID })).directions[0].stops
      let stopNames = stops.map(stop => stop.stopName)
      let startIndex = stopNames.indexOf(startStation)
      let endIndex = stopNames.indexOf(endStation)
      let affectedStops = stops.slice(startIndex, endIndex + 1)
      let affectedStopGTFSIDs = affectedStops.map(stop => stop.stopGTFSID)

      let matchingTrips = await gtfsTimetables.findDocuments({
        operationDays: today,
        mode: 'metro train',
        routeGTFSID,
        stopTimings: {
          $elemMatch: {
            stopGTFSID: {
              $in: affectedStopGTFSIDs
            },
            departureTimeMinutes: {
              $gt: startMinutesPastMidnight,
              $lt: endMinutesPastMidnight
            }
          }
        }
      }).toArray()

      let downStopsAffected = affectedStopGTFSIDs.slice(0, -1)
      let upStopsAffected = affectedStopGTFSIDs.slice(1)

      await async.forEach(matchingTrips, async trip => {
        let liveTrip = trip
        liveTrip.operationDays = today
        liveTrip.type = 'suspension'
        liveTrip.stopTimings = liveTrip.stopTimings.map(stop => {
          if (trip.direction === 'Down') {
            stop.showReplacementBus = downStopsAffected.includes(stop.stopGTFSID)
          } else {
            stop.showReplacementBus = upStopsAffected.includes(stop.stopGTFSID)
          }
          return stop
        })

        let startName = startStation.slice(0, -16)
        let endName = endStation.slice(0, -16)

        if (trip.direction === 'Down') {
          liveTrip.message = `Buses replace trains from ${startName} to ${endName}`
          liveTrip.suspension = {
            startName, endName
          }
        } else {
          liveTrip.message = `Buses replace trains from ${endName} to ${startName}`
          liveTrip.suspension = {
            startName: endName,
            endStation: startName
          }
        }
        delete liveTrip._id

        await liveTimetables.createDocument(liveTrip)
      })
    })
  })
}

module.exports = runHealthCheck
