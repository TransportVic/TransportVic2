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
  } else if (['regional coach', 'ferry'].includes(mode)) {
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

let allSprinters = []
for (let i = 7001; i <= 7022; i++) {
  if (i !== 7019) allSprinters.push(i.toString())
}

router.get('/sty', async (req, res) => {
  let vlineTrips = res.db.getCollection('vline trips')
  let now = utils.now()
  let prevFriday = utils.now()
  prevFriday.day(prevFriday.day() >= 5 ? 5 : -2)

  let days = utils.allDaysBetweenDates(prevFriday, now).map(d => d.format('YYYYMMDD'))

  let sprinters = (await vlineTrips.distinct('consist', {
    consist: /70\d\d/,
    date: {
      $in: days
    }
  })).sort((a, b) => a - b)

  let missing = allSprinters.filter(s => !sprinters.includes(s))

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

module.exports = router
