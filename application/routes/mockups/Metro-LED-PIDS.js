const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

let northernGroup = [
  "Craigieburn",
  "Sunbury",
  "Upfield",
  "Werribee",
  "Williamstown",
  "Showgrounds/Flemington"
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

async function getData(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.station + '-railway-station'
  })

  let departures = (await getDepartures(station, res.db, 3, false, req.params.platform, 1))
    .filter(departure => {
      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')
      let secondsDifference = diff.diff(utils.now(), 'seconds')
      return minutesDifference < 180 && secondsDifference >= 10 // minutes round down
      return true
    })

  return departures
}

router.get('/:station/:platform', async (req, res) => {
  res.render('mockups/metro-led-pids/pids.pug')
})

router.post('/:station/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json({departures})
})

module.exports = router



/*
box: 335px wide, 120 tall
2.72:1

blue bit 60px, 50% height
white line 8px from top, 6% height
2px tall, 1.6% height
text 20px from top, 25% height, font size 10px 8.3%

next train 15px from left, 54px wide, 10px from top
destination 18px from left, 60px wide, 10px from top
min to depart 135px from left, 40px wide

light bit 320px wide, center, 95%w, 54 tall 45%h
. matrix 302px wide 17px tall, 9px inbetween


*/
