const express = require('express')
const utils = require('../../../utils')
const render = require('./render-bus')
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

  if (!matchingRoute) return res.status(404).render('errors/no-route')

  let bestDirection = matchingRoute.directions.sort((a, b) => a.directionName.localeCompare(b.directionName))[0]
  let codedName = utils.encodeName(bestDirection.directionName)

  res.redirect('/bus/route/' + routeNumber + '/' + codedName)
})

router.get('/:routeNumber/:directionName/:operationDateType*?', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {routeNumber, directionName, operationDateType} = req.params
  if (['regional', 'named'].includes(routeNumber)) return next()

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    routeNumber,
    routeGTFSID: /(4|7|8)-/,
    'operationDate.type': operationDateType ? operationDateType : undefined
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})

module.exports = router
