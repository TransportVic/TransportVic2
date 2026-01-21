import express from 'express'
import utils from '../../../utils.mjs'
import render from './utils/render-tram.mjs'

const router = new express.Router()

router.get('/:routeNumber', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let {routeNumber} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'tram',
    routeNumber
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')

  let bestDirection = matchingRoute.directions.sort((a, b) => a.directionName.localeCompare(b.directionName))[0]
  let cleanName = utils.encodeName(bestDirection.directionName)

  res.redirect('/tram/route/' + routeNumber + '/' + cleanName)
})

router.get('/:routeNumber/:directionName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {routeNumber, directionName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'tram',
    routeNumber
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})

export default router