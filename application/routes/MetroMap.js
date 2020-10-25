const async = require('async')
const express = require('express')
const router = new express.Router()
const utils = require('../../utils')
const turf = require('@turf/turf')
const stationCodes = require('../../additional-data/station-codes')
const platformGeometry = require('../../additional-data/station-platform-geometry')

let platformCentrepoints = {}
Object.keys(platformGeometry).forEach(station => {
  platformGeometry[station].forEach(platform => {
    let centre = turf.center(platform.geometry)
    platformCentrepoints[station + platform.platformNumber] = centre.geometry
  })
})

let stationCodeLookup = {}

Object.keys(stationCodes).forEach(stationCode => {
  stationCodeLookup[stationCodes[stationCode]] = stationCode
})

router.post('/', async (req, res) => {
  let liveTimetables = res.db.getCollection('live timetables')
  let msNow = +new Date()

  let now = utils.now()

  let activeTrips = await liveTimetables.findDocuments({
    mode: 'metro train',
    'stopTimings.actualDepartureTimeMS': {
      $gte: msNow - 1000 * 60 * 3,
      $lte: msNow + 1000 * 60 * 4
    }
  }).toArray()

  let vehicles = []

  await async.forEach(activeTrips, async trip => {
    let nextStop = trip.stopTimings.find(stop => stop.actualDepartureTimeMS > msNow)
    let lastStop = trip.stopTimings.slice(-1)[0]
    let firstStop = trip.stopTimings[0]

    if (!nextStop) nextStop = lastStop
    if (nextStop !== lastStop && nextStop !== firstStop) nextStop = trip.stopTimings[trip.stopTimings.indexOf(nextStop) - 1]

    if (nextStop === firstStop && nextStop.actualDepartureTimeMS - now > 1000 * 30) return
    if (nextStop === lastStop && nextStop.actualDepartureTimeMS - now < -1000 * 30) return

    let platformCentre = platformCentrepoints[nextStop.stopName.slice(0, -16) + nextStop.platform]

    let bearing = 0

    let followingStop = trip.stopTimings[trip.stopTimings.indexOf(nextStop) + 1]
    if (followingStop) {
      let followingPlatformCentre = platformCentrepoints[followingStop.stopName.slice(0, -16) + followingStop.platform]
      if (followingPlatformCentre && platformCentre)
        bearing = turf.rhumbBearing(platformCentre, followingPlatformCentre)
    } else {
      let previousStop = trip.stopTimings[trip.stopTimings.indexOf(nextStop) - 1]

      let previousPlatformCentre = platformCentrepoints[previousStop.stopName.slice(0, -16) + previousStop.platform]
      if (previousPlatformCentre && platformCentre)
        bearing = turf.rhumbBearing(previousPlatformCentre, platformCentre)
    }

    vehicles.push({
      destinationCode: stationCodeLookup[trip.trueDestination.slice(0, -16)],
      destination: trip.trueDestination,
      runID: trip.runID,
      vehicle: trip.vehicle,
      nextStop,
      location: platformCentre,
      line: utils.encodeName(trip.routeName),
      bearing
    })
  })

  res.json(vehicles)
})

router.get('/', async (req, res) => {
  res.render('metro-map')
})

module.exports = router
