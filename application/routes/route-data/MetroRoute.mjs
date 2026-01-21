import express from 'express'
import utils from '../../../utils.mjs'
import render from './utils/render-train.mjs'

const router = new express.Router()

router.get('/:routeName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let {routeName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'metro train',
    cleanName: routeName
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')

  let bestDirection = matchingRoute.directions.find(direction => direction.trainDirection === 'Down')
  let cleanName = utils.encodeName(bestDirection.directionName)

  res.redirect('/metro/line/' + routeName + '/' + cleanName)
})

router.get('/:routeName/:directionName', async (req, res, next) => {
  let {db} = res
  let routes = db.getCollection('routes')
  let gtfsTimetables = db.getCollection('gtfs timetables')

  let {routeName, directionName} = req.params

  let matchingRoute = await routes.findDocument({
    mode: 'metro train',
    cleanName: routeName
  })

  if (!matchingRoute) return res.status(404).render('errors/no-route')
  render(req.params, res, matchingRoute)
})

export default router