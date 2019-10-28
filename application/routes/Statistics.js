const express = require('express')
const router = new express.Router()
const path = require('path')
const async = require('async')

router.get('/', (req, res) => {
  res.render('stats/index')
})

router.get('/gtfs-stats', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(__dirname, '../../load-gtfs/stats.json'))
})

router.get('/smartrak-stats', async (req, res) => {
  let smartrakIDs = res.db.getCollection('smartrak ids')
  let operators = await smartrakIDs.distinct('operator')
  let operatorCount = {}
  await async.forEach(operators, async operator => {
    operatorCount[operator] = await smartrakIDs.countDocuments({ operator })
  })

  res.json(operatorCount)
})

module.exports = router
