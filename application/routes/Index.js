const express = require('express')
const router = new express.Router()
const getDepartures = require('../../modules/vline/realtime_arrivals/get_departures')

router.get('/', (req, res) => {
  res.render('index')
})

module.exports = router
