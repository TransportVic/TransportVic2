import express from 'express'
import utils from '../../utils.mjs'
import { findStops } from './Search.mjs'
import escapeRegexString from 'escape-regex-string'
import JourneyPlanner from '../model/jp/JourneyPlanner.mjs'
import pug from 'pug'
import path from 'path'

const renderJourney = () => pug.compileFile(
  path.join(import.meta.dirname, '..', 'views', 'jp', 'journey.pug')
)

const router = new express.Router()

router.get('/', (req, res) => {
  res.render('jp/index')
})

router.post('/stops', async (req, res) => {
  const query = req.body.query.trim()
  const escaped = escapeRegexString(query)

  const matchingStops = await findStops(res.db, escaped)

  res.json(matchingStops.map(stop => ({
    id: stop._id.toString(),
    suburb: stop.suburb[0],
    name: stop.mergeName,
    modes: [...new Set(stop.bays.map(bay => bay.mode))]
  })))
})

router.post('/plan', async (req, res) => {
  const {
    arriveBy,
    originStop,
    destinationStop,
    dateTime
  } = req.body

  const planner = new JourneyPlanner(res.db)
  const plan = await planner.plan(originStop, destinationStop, new Date(dateTime), arriveBy)

  if (plan.error) return res.json(plan)

  res.json({
    journeys: plan.journeys.map(journey => ({
      html: renderJourney()({ journey })
    }))
  })
})

export default router