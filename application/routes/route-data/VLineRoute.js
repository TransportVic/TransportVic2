const express = require('express')
const utils = require('../../../utils')
const render = require('./utils/render-train')
const router = new express.Router()

router.get('/:routeName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let {routeName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'regional train',
    codedName: routeName
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')

  let bestDirection = matchingRoute.directions.find(direction => direction.directionName.includes(matchingRoute.routeName))
  let codedName = utils.encodeName(bestDirection.directionName)

  res.redirect('/vline/line/' + routeName + '/' + codedName)
})

router.get('/:routeName/:directionName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {routeName, directionName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'regional train',
    codedName: routeName
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})

module.exports = router
