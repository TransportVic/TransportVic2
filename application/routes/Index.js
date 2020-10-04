const express = require('express')
const utils = require('../../utils')
const {exec} = require('child_process')
const fs = require('fs')
const path = require('path')
const router = new express.Router()
const getStonyPoint = require('../../modules/get-stony-point')

let buildNumber, buildComment
let mapSVG

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

fs.readFile(path.join(__dirname, '../static/images/interactives/trains-new.svg'), (err, data) => {
  mapSVG = data.toString()
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

router.get('/railmap', (req, res) => {
  res.render('rail-map', { mapSVG })
})

router.get('/stop-data', async (req, res) => {
  let {mode, suburb, name} = req.query
  let stops = res.db.getCollection('stops')
  let stop

  if (['metro train', 'regional train', 'heritage train'].includes(mode)) {
    stop = await stops.findDocument({
      codedName: name + '-railway-station',
    })
  } else if (['ferry'].includes(mode)) {
    stop = await stops.findDocument({
      codedName: name,
      'bays.mode': mode
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

router.get('/covid-19', (req, res) => {
  res.render('pages/covid-19')
})

router.get('/sty', async (req, res) => {
  let missing = await getStonyPoint(res.db)

  if (missing.length === 2) {
    res.render('test-sty', {
      sprinters: missing
    })
  } else {
    res.render('test-sty', {
      missing
    })
  }
})

router.get('/home-banner', (req, res) => {
  res.json({
    link: 'https://forms.gle/ThoBmjvQz2jWsZucA',
    alt: 'Site Survey',
    text: 'Site Survey: Kindly provide feedback about the site :)'
  })
  // res.json({
  //   link: 'https://www.patreon.com/transportsg',
  //   alt: 'Patreon',
  //   text: 'Hi! If you like this site please consider supporting me on patreon by clicking here!'
  // })
})

module.exports = router
