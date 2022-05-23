const async = require('async')
const express = require('express')
const utils = require('../../../utils')
const url = require('url')
const querystring = require('querystring')
const moment = require('moment')
const router = new express.Router()

const highlightData = require('../../../additional-data/bus-tracker/highlights')

router.get('/', (req, res) => {
  res.render('tracker/busminder/index')
})

router.get('/fleet', async (req, res) => {
  let {db} = res
  let busMinderBuses = db.getCollection('busminder buses')

  let {fleet} = querystring.parse(url.parse(req.url).query)
  let cutoff = +utils.now().add(-5, 'minutes')

  if (!fleet) {
    return res.render('tracker/busminder/by-fleet', {
      fleet: '',
      bus: null,
      now: utils.now()
    })
  }

  let bus = await busMinderBuses.findDocument({
    fleet,
    timestamp: {
      $gte: cutoff
    }
  })

  res.render('tracker/busminder/by-fleet', {
    fleet,
    bus,
    now: utils.now()
  })
})

router.get('/service', async (req, res) => {
  let {db} = res
  let busMinderBuses = db.getCollection('busminder buses')

  let {service} = querystring.parse(url.parse(req.url).query)
  let cutoff = +utils.now().add(-5, 'minutes')

  if (!service) {
    return res.render('tracker/bus/by-service', {
      service: '',
      buses: [],
      now: utils.now()
    })
  }

  let buses = await busMinderBuses.findDocuments({
    routeNumber: service,
    timestamp: {
      $gte: cutoff
    }
  }).sort({ fleet: 1 }).toArray()

  res.render('tracker/busminder/by-service', {
    service,
    buses,
    now: utils.now()
  })
})

router.get('/highlights', async (req, res) => {
  let {db} = res
  let busMinderBuses = db.getCollection('busminder buses')
  let cutoff = +utils.now().add(-5, 'minutes')

  let highlights = await async.map(highlightData, async section => {
    let trackBuses = section.track,
        routes = section.routes,
        type = section.type,
        buses = section.buses || 'include'

    let query = {
      timestamp: {
        $gte: cutoff
      },
      fleet: { $in: trackBuses },
      routeNumber: { $not: { $in: routes} }
    }

    if (type === 'include') {
      query.routeNumber = { $in: routes }
    }
    if (buses === 'exclude') {
      query.fleet = { $not: { $in: trackBuses } }
    }

    let busesMatched = await busMinderBuses.findDocuments(query).sort({fleet: 1}).toArray()

    return {
      ...section,
      buses: busesMatched
    }
  })

  res.render('tracker/busminder/highlights', {
    highlights,
    now: utils.now()
  })
})

module.exports = router
