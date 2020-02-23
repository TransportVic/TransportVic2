const express = require('express')
const utils = require('../../../utils')
const routeUtils = require('./route-utils')
const router = new express.Router()

router.get('/:routeNumber', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let {routeNumber} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    routeNumber,
    routeGTFSID: /(4|7|8)-/
  })

  if (!matchingRoute) return next()

  let bestDirection = matchingRoute.directions.sort((a, b) => a.directionName.localeCompare(b.directionName))[0]
  let codedName = utils.encodeName(bestDirection.directionName)

  res.redirect('/bus/route/' + routeNumber + '/' + codedName)
})

router.get('/:routeNumber/:directionName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {routeNumber, directionName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    routeNumber,
    routeGTFSID: /(4|7|8)-/
  })

  if (!matchingRoute) return next()
  let direction = matchingRoute.directions.find(direction => {
    return utils.encodeName(direction.directionName) === directionName
  })
  if (!direction) return res.redirect('/bus/route/' + routeNumber)

  let {gtfsDirection, stops} = direction
  let fullDirectionName = direction.directionName

  let otherDirection = matchingRoute.directions.find(direction => {
    return direction.directionName !== fullDirectionName
  }) || direction

  let directionNames = [
    fullDirectionName,
    otherDirection.directionName
  ]

  let operator = utils.encodeName(matchingRoute.operators[0])

  let query = {
    mode: 'bus',
    routeGTFSID: matchingRoute.routeGTFSID,
    gtfsDirection: gtfsDirection.toString()
  }

  let firstLastBusMap = await routeUtils.generateFirstLastBusMap(gtfsTimetables, query)
  let frequencyMap = await routeUtils.generateFrequencyMap(gtfsTimetables, query, stops)

  res.render('routes/bus', {
    route: matchingRoute,
    direction,
    operator,
    directionNames,
    firstLastBusMap,
    frequencyMap
  })
})

module.exports = router
