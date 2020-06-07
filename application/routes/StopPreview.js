const express = require('express')
const utils = require('../../utils')
const router = new express.Router()
const bayData = require('../../additional-data/bus-bays')
const turf = require('@turf/turf')

router.post('/:suburb/:stopName', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  let bbox = turf.bboxPolygon(turf.bbox(stop.location))
  stop.bbox = bbox
  res.json(stop)
})

router.get('/:suburb/:stopName', (req, res) => {
  res.render('stop-preview')
})

router.get('/bays', (req, res) => {
  res.json(bayData)
})

module.exports = router
