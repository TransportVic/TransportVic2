const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

const getLineStops = require('./route-stops')

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central', 'Flinders Street']

function findExpressStops(stopTimings, stops) {
  stopTimings = stopTimings.filter(stop => {
    return !cityLoopStations.includes(stop.stopName.slice(0, -16))
  })

  let firstStop = stopTimings[0]
  let firstStopName = firstStop.stopName
  let lastStop = stopTimings.slice(-1)[0]
  let lastStopName = lastStop.stopName

  let firstStopIndex = stops.indexOf(firstStopName)
  let lastStopIndex = stops.indexOf(lastStopName) + 1
  let relevantStops = stops.slice(firstStopIndex, lastStopIndex)

  let expressParts = []

  let lastMainMatch = 0
  let expressStops = 0

  for (let scheduledStop of stopTimings) {
    let matchIndex = -1

    for (let stop of relevantStops) {
      matchIndex++

      if (stop === scheduledStop.stopName) {
        if (matchIndex !== lastMainMatch) { // there has been a jump - exp section
          let expressPart = relevantStops.slice(lastMainMatch, matchIndex)
          expressParts.push(expressPart)
        }

        lastMainMatch = matchIndex + 1
        break
      }
    }
  }

  return expressParts
}

function determineStoppingPattern(expressParts, destination, stops) {
  if (expressParts.length === 0) return 'Stops All Stations'
  if (expressParts.length === 1 && expressParts[0].length === 1) return 'All Except ' + expressParts[0][0].slice(0, -16)
  let texts = []

  let lastStop = null

  expressParts.forEach((expressSection, i) => {
    let firstExpressStop = expressSection[0]
    let lastExpressStop = expressSection.slice(-1)[0]

    let previousStop = stops[stops.indexOf(firstExpressStop) - 1]
    let nextStop = stops[stops.indexOf(lastExpressStop) + 1]
    if (lastStop) {
      if (lastStop === previousStop) {
        texts.push(`${previousStop} to ${nextStop}`)
      } else {
        texts.push(`Stops All Stations from ${lastStop} to ${previousStop}`)
        texts.push(`Runs Express from ${previousStop} to ${nextStop}`)
      }
    } else {
      texts.push(`Stops All Stations to ${previousStop}`)
      texts.push(`Runs Express from ${previousStop} to ${nextStop}`)
    }

    lastStop = nextStop
  })

  texts.push('then Stops All Stations to ' + destination)

  return texts.join(', ').replace(/ Railway Station/g, '')
}

async function getData(req, res) {
  let routes = res.db.getCollection('routes')
  let station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  let {platform} = req.params

  let allDepartures = await getDepartures(station, res.db, 10, false, null, 1)
  let hasRRB = !!allDepartures.find(d => d.platform === 'RRB')
  allDepartures = allDepartures.filter(d => d.platform !== 'RRB')

  let platformDepartures = await async.map(allDepartures.filter(departure => {
    if (departure.platform !== platform) return false

    let diff = departure.actualDepartureTime
    let minutesDifference = diff.diff(utils.now(), 'minutes')
    let secondsDifference = diff.diff(utils.now(), 'seconds')

    return minutesDifference < 180 && secondsDifference >= 10 // minutes round down
  }), async departure => {
    let {trip, destination} = departure
    let {routeGTFSID, direction, stopTimings} = trip

    let hasSeenStop = false
    stopTimings = stopTimings.filter(stop => {
      if (hasSeenStop) return true
      if (stop.stopName === station.stopName) {
        hasSeenStop = true
        return true
      }
      return false
    })
    //
    // let route = await routes.findDocument({
    //   mode: 'metro train',
    //   routeGTFSID
    // })
    //
    // if (!route) console.log(trip)

    let routeStops = getLineStops(trip.shortRouteName || trip.routeName).map(e => e + ' Railway Station')
    if (direction === 'Up') {
      routeStops = routeStops.slice(0).reverse()
    }

    // let routeDirection = route.directions.find(d => d.trainDirection == direction)
    // if (!routeDirection) console.log(route.directions, direction)
    // let routeStops = routeDirection.stops
    let expresses = findExpressStops(stopTimings, routeStops)
    let stoppingPattern = determineStoppingPattern(expresses, destination, routeStops)

    let expressCount = expresses.reduce((a, e) => a + e.length, 0)
    if (expressCount === 0) departure.stoppingType = 'Stops All Stations'
    else if (expressCount < 5) departure.stoppingType = 'Limited Express'
    else departure.stoppingType = 'Express Service'

    departure.stoppingPattern = stoppingPattern
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
