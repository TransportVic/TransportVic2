const express = require('express')
const utils = require('../../utils')
const config = require('../../config')
const fs = require('fs')
const path = require('path')
const async = require('async')
const rateLimit = require('express-rate-limit')
const { getPHDayOfWeek, getPublicHolidayName } = require('../../public-holidays')
const router = new express.Router()

let robots = fs.readFileSync(path.join(__dirname, '../static/app-content/robots.txt'))
let sw = fs.readFileSync(path.join(__dirname, '../static/app-content/sw.js'))

let upcomingPH = []

async function initDB(db) {
  let now = utils.now()
  let days = utils.allDaysBetweenDates(now, now.clone().add(7, 'days'))

  await async.forEach(days, async day => {
    let phName = getPublicHolidayName(day)

    if (phName) {
      let phDay = await getPHDayOfWeek(day)
      upcomingPH.push({
        name: phName,
        day: day,
        scheduleDay: phDay
      })
    }
  })

  upcomingPH = upcomingPH.sort((a, b) => a.day - b.day)
}

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

router.get('/home-banner', (req, res) => {
  if (upcomingPH.length) {
    let link = `/public-holiday/${upcomingPH.map(ph => utils.getYYYYMMDD(ph.day)).join('-')}`
    if (upcomingPH.length === 1) {
      res.json({
        link,
        alt: 'Public Holiday Alert',
        text: `${upcomingPH[0].day.format('dddd, MMMM Do YYYY')} (${upcomingPH[0].name}): PTV Runs to a ${upcomingPH[0].scheduleDay} timetable`
      })
    } else {
      let names = upcomingPH.map(ph => ph.name)

      res.json({
        link,
        alt: 'Public Holiday Alert',
        text: `Upcoming Public Holidays: ${names.slice(0, -1).join(', ')} & ${names.slice(-1)[0]}`
      })
    }
  } else {
    res.json({
      link: 'https://www.patreon.com/transportsg',
      alt: 'Patreon',
      text: 'Hi! If you like this site please consider supporting me on patreon by clicking here!'
    })
  }
})

router.get('/sw.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'application/javascript')
  res.end(sw)
})

router.get('/robots.txt', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'text/plain')
  res.end(robots)
})

router.get('/.well-known/acme-challenge/:key', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20
}))

router.get('/.well-known/acme-challenge/:key', (req, res) => {
  let filePath = path.join(config.webrootPath, req.params.key)
  let stream = fs.createReadStream(filePath)
  stream.pipe(res)

  stream.on('error', err => {
    res.status(404).end('404')
  })
})

module.exports = router
module.exports.initDB = initDB
