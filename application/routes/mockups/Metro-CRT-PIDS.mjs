import express from 'express'
import utils from '../../../utils.mjs'
import PIDBackend from './PIDBackend.mjs'

const router = new express.Router()

async function getData(req, res) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  return await PIDBackend.getPIDData(station, req.params.platform, {}, res.db)
}

router.get('/:station/:platform', async (req, res) => {
  getData(req, res)

  res.render('mockups/metro-crt', { now: utils.now() })
})

router.post('/:station/:platform/', async (req, res) => {
  let departures = await getData(req, res)
  res.json(departures)
})

export default router
