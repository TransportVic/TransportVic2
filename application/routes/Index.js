const express = require('express')
const utils = require('../../utils')
const {exec} = require('child_process')
const router = new express.Router()

let buildNumber, buildComment

exec('git describe --always', {
    cwd: process.cwd()
}, (err, stdout, stderr) => {
  buildNumber = stdout.toString().trim();

  exec('git log -1 --oneline --pretty=%B', {
    cwd: process.cwd()
  }, (err, stdout, stderr) => {
    buildComment = stdout.toString().trim();
  })
})

router.get('/', (req, res) => {
  res.render('index')
})

router.get('/bookmarks', (req, res) => {
  res.render('bookmarks')
})

router.get('/about', (req, res) => {
  res.render('about', {buildNumber, buildComment})
})

router.get('/stop-data', async (req, res) => {
  let {mode, suburb, name} = req.query
  let stops = res.db.getCollection('stops')
  let stop

  if (['metro train', 'regional train'].includes(mode)) {
    stop = await stops.findDocument({
      codedName: name + '-railway-station',
    })
  } else if (mode === 'regional coach') {
    stop = await stops.findDocument({
      codedName: name,
      'bays.mode': 'regional coach'
    })
  } else {
    stop = await stops.findDocument({
      codedSuburb: suburb,
      codedName: name
    })
  }

  if (!stop) return res.json(null)

  let stopData = {
    codedName: stop.codedName,
    codedSuburb: stop.codedSuburb[0],
    suburb: stop.suburb[0],
    stopName: stop.stopName,
    stopGTFSIDs: stop.bays.map(bay => bay.stopGTFSID).filter((e, i, a) => a.indexOf(e) === i)
  }

  res.json(stopData)
})

router.get('/colours', async (req, res) => {
  let operators = (await res.db.getCollection('routes').distinct('operators')).sort()
  let tramRoutes = await res.db.getCollection('routes').distinct('routeNumber', { mode: 'tram' })
  let trainLines = await res.db.getCollection('routes').distinct('routeName', { mode: 'metro train' })

  operators = operators.map(operator => {
    return {
      cssName: utils.encodeName(operator.replace(/ \(.+/, '')),
      originalName: operator
    }
  })
  trainLines = trainLines.map(operator => {
    return {
      cssName: utils.encodeName(operator),
      originalName: operator
    }
  })
  tramRoutes = tramRoutes.map(route => route.replace('/3a', ''))
    .sort((a, b) => a - b)
  res.render('colours', {operators, tramRoutes, trainLines})
})

router.get('/maps', (req, res) => {
  res.render('maps')
})

router.get('/track-mapping', (req, res) => {
  res.render('track-mapping')
})

module.exports = router
