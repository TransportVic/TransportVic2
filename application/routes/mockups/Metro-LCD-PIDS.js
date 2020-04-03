const express = require('express')
const router = new express.Router()
const async = require('async')
const utils = require('../../../utils')
const TrainUtils = require('./TrainUtils')
const getLineStops = require('./route-stops')

let stoppingTextMap = {
  stopsAll: 'Stops All Stations',
  allExcept: 'Not Stopping At {0}',
  expressAtoB: '{0} to {1}',
  sasAtoB: 'Stops All Stations from {0} to {1}',
  runsExpressAtoB: 'Runs Express from {0} to {1}',
  runsExpressTo: 'Runs Express to {0}',
  sasTo: 'Stops All Stations to {0}',
  thenSASTo: 'then Stops All Stations to {0}'
}

let northernGroup = [
  "Craigieburn",
  "Sunbury",
  "Upfield",
  "Werribee",
  "Williamstown",
  "Showgrounds/Flemington"
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

async function getData(req, res) {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  let stationName = station.stopName.slice(0, -16)

  let {platform} = req.params

  let allDepartures = await TrainUtils.getCombinedDepartures(station, res.db)
  let hasRRB = !!allDepartures.find(d => d.platform === 'RRB')
  allDepartures = allDepartures.filter(d => d.platform !== 'RRB')
  let platformDepartures = TrainUtils.filterPlatforms(allDepartures, req.params.platform)
// TODO: refactor into TrainUtils.appendTextualDepartureData
  platformDepartures = platformDepartures.map(departure => {
    let {trip, destination} = departure
    let {routeGTFSID, direction, stopTimings} = trip
    let isUp = direction === 'Up' || departure.forming || false
    let routeName = trip.shortRouteName || trip.routeName
    let isVLine = departure.type === 'vline'

    stopTimings = stopTimings.map(stop => stop.stopName.slice(0, -16))

    let routeStops = getLineStops(routeName)
    if (destination === 'City Loop') destination = 'Flinders Street'

    if (isUp) routeStops = routeStops.slice(0).reverse()

    let expresses = TrainUtils.findExpressStops(stopTimings, routeStops, routeName, isUp, isVLine, stationName)
    let stoppingPattern = TrainUtils.determineStoppingPattern(expresses, destination, routeStops, stationName, stoppingTextMap)

    departure.stoppingPattern = stoppingPattern

    let expressCount = expresses.reduce((a, e) => a + e.length, 0)

    if (departure.type === 'vline') {
      departure.stoppingType = 'No Suburban Passengers'
    } else if (expressCount === 0) departure.stoppingType = 'Stops All Stations'
    else if (expressCount < 5) departure.stoppingType = 'Limited Express'
    else departure.stoppingType = 'Express'

    departure = TrainUtils.appendScreenDataToDeparture(departure, station)

    return departure
  })

  let hasDepartures = allDepartures.length > 0

  return { departures: platformDepartures, hasDepartures, hasRRB }
}

router.get('/:station/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.render('mockups/metro-lcd-pids/pids', departures)
})

router.post('/:station/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json(departures)
})

module.exports = router
