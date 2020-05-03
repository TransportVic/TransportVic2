const express = require('express')
const router = new express.Router()
const getData = require('./SouthernCrossTrains')
const utils = require('../../../utils')

// true regional, false metro
let sssPlatforms = {
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
  6: true,
  7: true,
  8: true,
  9: false,
  10: false,
  11: false,
  12: false,
  13: false,
  14: false,
  15: true,
  16: true
}

router.get('/platform/:platforms/', async (req, res) => {
  let {platforms} = req.params
  platforms = platforms.split('-').map(p => sssPlatforms[p])

  res.render('mockups/southern-cross/platform', {platforms})
})

router.post('/:type/:platforms/', async (req, res) => {
  let data = await getData(req.params.platforms.split('-'), res.db)

  data.departures = data.departures.map(departure => {
    let {scheduledDepartureTime} = departure

    let timeDifference = departure.scheduledDepartureTime.clone().add(30, 'seconds').diff(utils.now(), 'minutes')
    departure.minutesToDeparture = timeDifference

    return departure
  })

  data.arrivals = data.arrivals.map(arrival => {
    let {scheduledDepartureTime} = arrival

    if (arrival.estimatedDepartureTime) {
      let timeDifference = arrival.estimatedDepartureTime.clone().add(30, 'seconds').diff(utils.now(), 'minutes')
      arrival.minutesToDeparture = timeDifference
    } else arrival.minutesToDeparture = null

    return arrival
  })

  res.json(data)
})

module.exports = router
