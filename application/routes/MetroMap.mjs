import async from 'async'
import express from 'express'
import utils from '../../utils.mjs'
import turf from '@turf/turf'
import stationCodes from '../../additional-data/station-codes.json' with { type: 'json' }
import platformGeometry from '../../additional-data/station-platform-geometry.json' with { type: 'json' }
import metroTypes from '../../additional-data/metro-tracker/metro-types.json' with { type: 'json' }
import config from '../../config.json' with { type: 'json' }

const router = new express.Router()

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
  let metroLocations = res.tripDB.getCollection('metro locations')
  let vlineLocations = res.tripDB.getCollection('vline locations')
  let metroTrips = res.tripDB.getCollection('metro trips')

  const positions = (await metroLocations.findDocuments({
    timestamp: {
      $gte: +utils.now().add(-3, 'minutes')
    }
  }).toArray()).concat(await vlineLocations.findDocuments({
    timestamp: {
      $gte: +utils.now().add(-3, 'minutes')
    }
  }).toArray())

  const vehicles = Object.values(positions.reduce((acc, vehicle) => ({
    ...acc,
    [vehicle.tripData.runID]: (acc[vehicle.tripData.runID] ? {
      ...vehicle,
      consist: [...acc[vehicle.tripData.runID].consist, ...vehicle.consist]
    } : vehicle)
  }), {})).map(vehicle => ({
    destinationCode: '???',
    destination: '???',
    runID: vehicle.tripData.runID,
    vehicle: vehicle.consist.join('-'),
    // nextStop,
    location: vehicle.location,
    line: utils.encodeName(vehicle.tripData.line),
    bearing: vehicle.bearing
  }))

  return res.json(vehicles)

  // let msNow = +new Date()
  // let days = {
  //   $in: [ utils.getYYYYMMDDNow() ]
  // }

  // let minutes = utils.getMinutesPastMidnightNow()

  // if (minutes > 23 * 60) days.$in.push(utils.getYYYYMMDD(utils.now().add(1, 'day')))
  // if (minutes < 120) days.$in.push(utils.getYYYYMMDD(utils.now().add(-1, 'day')))

  // let activeTrips = await liveTimetables.findDocuments({
  //   mode: 'metro train',
  //   $and: [{
  //     operationDays: days
  //   }, {
  //     'stopTimings.actualDepartureTimeMS': {
  //       $gte: msNow - 1000 * 60 * 3,
  //       $lte: msNow + 1000 * 60 * 4
  //     }
  //   }],
  //   cancelled: {
  //     $ne: true
  //   }
  // }).toArray()

  // let vehicles = []

  // await async.forEach(activeTrips, async trip => {
  //   let nextStop = trip.stopTimings.find(stop => stop.actualDepartureTimeMS > msNow + 1000 * 60)

  //   let lastStop = trip.stopTimings.slice(-1)[0]
  //   let firstStop = trip.stopTimings[0]

  //   if (!nextStop) nextStop = lastStop

  //   let tripData = await metroTrips.findDocument({
  //     date: trip.operationDays,
  //     runID: trip.runID
  //   })

  //   let trainLocation = tripData ? await metroLocations.findDocument({
  //     consist: tripData.consist[0]
  //   }) : null

  //   if (tripData && trainLocation && (msNow - trainLocation.timestamp) < 1000 * 60 * 2) {
  //     let vehicleType = metroTypes[tripData.consist[0]]

  //     vehicles.push({
  //       destinationCode: stationCodeLookup[trip.trueDestination.slice(0, -16)],
  //       destination: trip.trueDestination.slice(0, -16),
  //       runID: trip.runID,
  //       vehicle: `${tripData.consist.length} Car ${vehicleType.type}`,
  //       nextStop,
  //       location: trainLocation.location,
  //       line: utils.encodeName(trip.routeName),
  //       bearing: trainLocation.bearing
  //     })
  //   } else {
  //     if (nextStop !== lastStop && nextStop !== firstStop) nextStop = trip.stopTimings[trip.stopTimings.indexOf(nextStop) - 1]

  //     if (nextStop === firstStop && nextStop.actualDepartureTimeMS - msNow > 1000 * 30) return
  //     if (nextStop === lastStop && nextStop.actualDepartureTimeMS - msNow < -1000 * 30) return

  //     let platformCentre = platformCentrepoints[nextStop.stopName.slice(0, -16) + nextStop.platform]

  //     let bearing = 0

  //     let followingStop = trip.stopTimings[trip.stopTimings.indexOf(nextStop) + 1]
  //     if (followingStop) {
  //       let followingPlatformCentre = platformCentrepoints[followingStop.stopName.slice(0, -16) + followingStop.platform]
  //       if (followingPlatformCentre && platformCentre)
  //         bearing = turf.rhumbBearing(platformCentre, followingPlatformCentre)
  //     } else {
  //       let previousStop = trip.stopTimings[trip.stopTimings.indexOf(nextStop) - 1]

  //       let previousPlatformCentre = platformCentrepoints[previousStop.stopName.slice(0, -16) + previousStop.platform]
  //       if (previousPlatformCentre && platformCentre)
  //         bearing = turf.rhumbBearing(previousPlatformCentre, platformCentre)
  //     }

  //     vehicles.push({
  //       destinationCode: stationCodeLookup[trip.trueDestination.slice(0, -16)],
  //       destination: trip.trueDestination.slice(0, -16),
  //       runID: trip.runID,
  //       vehicle: trip.vehicle ? `${trip.vehicle.size} Car ${trip.vehicle.type}` : 'Unknown',
  //       nextStop,
  //       location: platformCentre,
  //       line: utils.encodeName(trip.routeName),
  //       bearing,
  //       poorLocation: true
  //     })
  //   }
  // })

  // res.json(vehicles)
})

router.get('/', async (req, res) => {
  const allowedOrigins = `'self' ${config.staticBase || ''} ${config.pidStaticBase || ''} static.cloudflareinsights.com`
  res.setHeader('Content-Security-Policy', `script-src ${allowedOrigins} blob:;
    img-src ${allowedOrigins} api.mapbox.com data:;
    frame-src 'self';
  `.replaceAll(/\n +/g, ' ').trim())
  
  res.render('metro-map')
})

export default router