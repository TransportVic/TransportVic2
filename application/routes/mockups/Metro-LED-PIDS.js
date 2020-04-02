const express = require('express')
const router = new express.Router()
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

const TrainUtils = require('./TrainUtils')
const getLineStops = require('./route-stops')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central', 'Flinders Street']

async function getData(req, res) {
  let routes = res.db.getCollection('routes')
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })
  let stationName = station.stopName.slice(0, -16)

  let {platform} = req.params

  let allDepartures = await TrainUtils.getCombinedDepartures(station, res.db)
  let hasRRB = !!allDepartures.find(d => d.platform === 'RRB')
  allDepartures = allDepartures.filter(d => d.platform !== 'RRB')
  let platformDepartures = TrainUtils.filterPlatforms(allDepartures, req.params.platform)

  platformDepartures = platformDepartures.map(departure => {
    let {trip, destination} = departure
    let {routeGTFSID, direction, stopTimings} = trip
    let isUp = direction === 'Up' || departure.forming
    let routeName = trip.shortRouteName || trip.routeName
    let isVLine = departure.type === 'vline'

    stopTimings = stopTimings.map(stop => stop.stopName.slice(0, -16))

    let startIndex = stopTimings.indexOf(stationName)
    let endIndex = stopTimings.length

    let routeStops = getLineStops(routeName)
    if (isUp) {
      routeStops = routeStops.slice(0).reverse()
      let fssIndex = stopTimings.indexOf('Flinders Street')
      if (fssIndex !== -1)
        endIndex = fssIndex
    }

    stopTimings = stopTimings.slice(startIndex, endIndex + 1)

    if (destination === 'City Loop') destination = 'Flinders Street'

    let expresses = TrainUtils.findExpressStops(stopTimings, routeStops, routeName, isUp, isVLine)
    let stoppingPattern = TrainUtils.determineStoppingPattern(expresses, destination, routeStops, stationName)

    departure.stoppingPattern = stoppingPattern

    let expressCount = expresses.reduce((a, e) => a + e.length, 0)

    if (departure.type === 'vline') {
      departure.stoppingType = 'V/Line Service'
      departure.stoppingPattern += ', Not Taking Suburban Passengers'
    } else if (expressCount === 0) departure.stoppingType = 'Stops All Stations'
    else if (expressCount < 5) departure.stoppingType = 'Limited Express'
    else departure.stoppingType = 'Express Service'


    return departure
  })

  let hasDepartures = allDepartures.length > 0

  return { departures: platformDepartures, hasDepartures, hasRRB }
}

router.get('/:station/:platform', async (req, res) => {
  res.render('mockups/metro-led-pids/pids.pug')
})

router.post('/:station/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json(departures)
})

module.exports = router


/*

FORMATS:
Stops All Stations
All Except $STATION
Express Service; Stops All Station to Dandenong, Runs Express from Dandenong to Noble Park, Stops All Stations from Noble Park to Springvale, Runs Express from Springvale to Clayton, Stops All Stations from Clayton to Caulfield, Runs Express from Caulfield to South Yarra, then Stops All Stations to Flinders Street
*/


/*
box: 335px wide, 120 tall
2.72:1

blue bit 60px, 50% height
white line 8px from top, 6% height
2px tall, 1.6% height
text 20px from top, 25% height, font size 10px 8.3%

next train 15px from left, 54px wide, 10px from top
destination 18px from left, 60px wide, 10px from top
min to depart 135px from left, 40px wide

light bit 320px wide, center, 95%w, 54 tall 45%h
. matrix 302px wide 17px tall, 9px inbetween


*/
