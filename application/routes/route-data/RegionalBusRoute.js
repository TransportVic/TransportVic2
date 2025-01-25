const express = require('express')
const utils = require('../../../utils')
const render = require('./utils/render-bus')
const router = new express.Router()

router.get('/:suburb/:routeNumber', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let {routeNumber, suburb} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    routeNumber,
    routeGTFSID: /6-/,
    cleanSuburbs: suburb
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')

  let bestDirection = matchingRoute.directions.sort((a, b) => a.directionName.localeCompare(b.directionName))[0]
  let codedName = utils.encodeName(bestDirection.directionName)

  res.redirect(`/bus/route/regional/${suburb}/${routeNumber}/${codedName}`)
})

router.get('/:suburb/:routeNumber/:directionName/:operationDateType?', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {routeNumber, directionName, suburb, operationDateType} = req.params
  if (['named'].includes(routeNumber)) return next()

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    routeNumber,
    routeGTFSID: /6-/,
    cleanSuburbs: suburb,
    'operationDate.type': operationDateType ? operationDateType : undefined
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})


module.exports = router
