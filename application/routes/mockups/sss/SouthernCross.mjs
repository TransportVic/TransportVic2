import express from 'express'
import getData from './SouthernCrossTrains.mjs'
import utils from '../../../../utils.mjs'

const router = new express.Router()

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

  res.render('mockups/sss/platform', { platforms, now: utils.now() })
})

router.get('/summary/', (req, res) => {
  res.render('mockups/sss/summary')
})

router.post('/:type/:platforms/', async (req, res) => {
  let data = await getData(req.params.platforms.split('-'), res.db)

  let departures = data.departures.map(departure => {
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
  })

  let arrivals = data.arrivals.map(arrival => {
    let {scheduledDepartureTime} = arrival

    if (arrival.estimatedDepartureTime) {
      let timeDifference = arrival.estimatedDepartureTime.clone().add(30, 'seconds').diff(utils.now(), 'minutes')
      if (timeDifference < 0) timeDifference = 0

      arrival.minutesToDeparture = timeDifference
    } else arrival.minutesToDeparture = null

    return arrival
  })

  res.json({ departures, arrivals })
})

export default router