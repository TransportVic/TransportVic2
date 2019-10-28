const express = require('express')
const router = new express.Router()
const path = require('path')

router.get('/', (req, res) => {
  res.render('stats/index')
})

router.get('/gtfs-stats', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(__dirname, '../../load-gtfs/stats.json'));
})

module.exports = router
