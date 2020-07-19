const express = require('express')
const utils = require('../../../utils')
const render = require('./utils/render-bus')
const router = new express.Router()

router.get('/:codedName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let {codedName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    codedName,
    routeGTFSID: /(4|6|7|8|11)-/
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')

  let bestDirection = matchingRoute.directions.sort((a, b) => a.directionName.localeCompare(b.directionName))[0]
  let codedDirection = utils.encodeName(bestDirection.directionName)

  res.redirect('/bus/route/named/' + codedName + '/' + codedDirection)
})

router.get('/:codedName/:directionName/:operationDateType*?', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {codedName, directionName, operationDateType} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    codedName,
    routeGTFSID: /(4|6|7|8|11)-/,
    'operationDate.type': operationDateType ? operationDateType : undefined
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})

module.exports = router
