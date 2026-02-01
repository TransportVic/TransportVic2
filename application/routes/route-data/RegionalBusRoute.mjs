import express from 'express'
import utils from '../../../utils.mjs'
import render from './utils/render-bus.mjs'

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
  let cleanName = utils.encodeName(bestDirection.directionName)

  res.redirect(`/bus/route/regional/${suburb}/${routeNumber}/${cleanName}`)
})

router.get('/:suburb/:routeNumber/:directionName/', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {routeNumber, directionName, suburb} = req.params
  if (['named'].includes(routeNumber)) return next()

  let matchingRoute = await routes.findDocument({
    mode: 'bus',
    routeNumber,
    routeGTFSID: /6-/,
    cleanSuburbs: suburb
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})

export default router