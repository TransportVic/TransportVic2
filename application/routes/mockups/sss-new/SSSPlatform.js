const express = require('express')
const router = new express.Router()
const moment = require('moment')
const async = require('async')
const utils = require('../../../../utils')

const TrainUtils = require('../TrainUtils')

function adjust(departure) {
  let {scheduledDepartureTime} = departure

  if (departure.type === 'vline') {
    let timeDifference = departure.scheduledDepartureTime.clone().add(30, 'seconds').diff(utils.now(), 'minutes')
    departure.minutesToDeparture = timeDifference
  } else {
    if (departure.estimatedDepartureTime) {
      let timeDifference = departure.estimatedDepartureTime.clone().add(30, 'seconds').diff(utils.now(), 'minutes')
      if (timeDifference < 0) timeDifference = 0

      departure.minutesToDeparture = timeDifference
    } else departure.minutesToDeparture = null
  }

  return departure
}

async function getData(req, res) {
  let station = await res.db.getCollection('stops').findDocument({
    codedName: 'southern-cross-railway-station'
  })

  let platforms = req.params.platform.split('-')

  let left = await TrainUtils.getPIDSDepartures(res.db, station, platforms[0], null, null)
  let right = await TrainUtils.getPIDSDepartures(res.db, station, platforms[1], null, null)

  return { left: left.departures.map(adjust), right: right.departures.map(adjust) }
}

router.get('/:platform', async (req, res) => {
  res.render('mockups/sss-new/platform.pug', { now: utils.now() })
})

router.post('/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json(departures)
})

module.exports = router
