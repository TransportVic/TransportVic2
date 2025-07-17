const express = require('express')
const utils = require('../../../utils')
const render = require('./utils/render-bus')
const router = new express.Router()

router.get('/:cleanName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let {cleanName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    cleanName,
    routeGTFSID: /(4|6|7|8|11|12)-/
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')

  let bestDirection = matchingRoute.directions.sort((a, b) => a.directionName.localeCompare(b.directionName))[0]
  let codedDirection = utils.encodeName(bestDirection.directionName)

  res.redirect('/bus/route/named/' + cleanName + '/' + codedDirection)
})

router.get('/:cleanName/:directionName/{:operationDateType}', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {cleanName, directionName, operationDateType} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    cleanName,
    routeGTFSID: /(4|6|7|8|11|12)-/,
    'operationDate.type': operationDateType ? operationDateType : undefined
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})

module.exports = router
