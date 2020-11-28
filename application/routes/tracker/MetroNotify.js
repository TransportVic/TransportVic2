const express = require('express')
const utils = require('../../../utils')
const url = require('url')
const querystring = require('querystring')
const router = new express.Router()

router.get('/bot', async (req, res) => {
  let {db} = res
  let metroNotify = db.getCollection('metro notify')

  res.header('Access-Control-Allow-Origin', '*')

  let startOfDay = Math.floor(+utils.now().startOf('day') / 1000)
  let {date} = querystring.parse(url.parse(req.url).query)
  if (date) {
    startOfDay = Math.floor(+utils.parseDate(date) / 1000)
  }

  let endOfDay = startOfDay + 1440 * 60
  let trips = await metroNotify.findDocuments({
    $or: [{
      fromDate: {
        $gte: startOfDay,
        $lt: endOfDay
      },
    }, {
      toDate: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    }, {
      fromDate: {
        $lt: endOfDay
      },
      toDate: {
        $gte: endOfDay
      }
    }]
  }).toArray()

  res.json(trips)
})

module.exports = router
