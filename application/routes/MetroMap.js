const async = require('async')
const express = require('express')
const router = new express.Router()
const utils = require('../../utils')
const turf = require('@turf/turf')
const stationCodes = require('../../additional-data/station-codes')
const platformGeometry = require('../../additional-data/station-platform-geometry')
const metroTypes = require('../../additional-data/metro-tracker/metro-types')

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
  let metroLocations = res.db.getCollection('metro locations')
  let metroTrips = res.db.getCollection('metro trips')

  let msNow = +new Date()
  let days = {
    $in: [ utils.getYYYYMMDDNow() ]
  }

  let minutes = utils.getMinutesPastMidnightNow()

  if (minutes > 23 * 60) days.$in.push(utils.getYYYYMMDD(utils.now().add(1, 'day')))
  if (minutes < 120) days.$in.push(utils.getYYYYMMDD(utils.now().add(-1, 'day')))

  let activeTrips = await liveTimetables.findDocuments({
    mode: 'metro train',
    $and: [{
      operationDays: days
    }, {
      'stopTimings.actualDepartureTimeMS': {
        $gte: msNow - 1000 * 60 * 3,
        $lte: msNow + 1000 * 60 * 4
      }
    }],
    cancelled: {
      $ne: true
    }
  }).toArray()

  let vehicles = []

  await async.forEach(activeTrips, async trip => {
    let nextStop = trip.stopTimings.find(stop => stop.actualDepartureTimeMS > msNow + 1000 * 60)

    let tripData = await metroLocations.findDocument({
      date: trip.operationDays,
      runID: trip.runID
    })

    if (tripData) {
      let location = await metroLocations.findDocument({
        consist: tripDay.consist[0]
      })

      let vehicleType = metroTypes.find(car => tripData.consist[0] === car.leadingCar)

      vehicles.push({
        destinationCode: stationCodeLookup[trip.trueDestination.slice(0, -16)],
        destination: trip.trueDestination.slice(0, -16),
        runID: trip.runID,
        vehicle: `${tripData.consist.length} Car ${vehicleType.type}`,
        nextStop,
        location: platformCentre,
        line: utils.encodeName(trip.routeName),
        bearing
      })
    }
  })

  res.json(vehicles)
})

router.get('/', async (req, res) => {
  res.render('metro-map')
})

module.exports = router
