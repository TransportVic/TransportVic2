const express = require('express')
const utils = require('../../utils')
const config = require('../../config')
const fs = require('fs')
const path = require('path')
const async = require('async')
const { getPHDayOfWeek, getPublicHolidayName } = require('../../public-holidays')
const { exec } = require('child_process')
const router = new express.Router()

let robots = fs.readFileSync(path.join(__dirname, '../static/app-content/robots.txt'))
let sw = fs.readFileSync(path.join(__dirname, '../static/app-content/sw.js'))
let sitemap = fs.readFileSync(path.join(__dirname, '../static/app-content/sitemap.xml'))

let buildNumber, buildComment
let mapSVG

exec('git describe --always', {
    cwd: path.join(__dirname, '../..')
}, (err, stdout, stderr) => {
  buildNumber = stdout.toString().trim()

  exec('git log -1 --oneline --pretty=%B', {
    cwd: path.join(__dirname, '../..')
  }, (err, stdout, stderr) => {
    buildComment = stdout.toString().trim()
  })
})

fs.readFile(path.join(__dirname, '../static/images/interactives/railmap.svg'), (err, data) => {
  mapSVG = data.toString()
})

let upcomingPH = []

async function initDB(db) {
  setTimeout(async () => {
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
  }, 1000)
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
      cleanSuburbs: suburb,
      codedName: name
    })
  }

  if (!stop) return res.json(null)

  let stopData = {
    codedName: stop.codedName,
    cleanSuburbs: stop.cleanSuburbs[0],
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
    if (req.headers.host !== 'transportvic.me') {
      res.json({
        link: 'https://transportvic.me',
        alt: 'Notice',
         text: 'TransportVic is now transportvic.me! Please update your bookmarks and use the new link.'
      })
    } else {
      res.json({
        link: '#',
        alt: 'Alert',
         text: 'PTV bus fleet data is currently unavailable due to a PTV data error.'
      })
    }
/*
    res.json({
      link: 'https://www.patreon.com/transportsg',
      alt: 'Patreon',
      text: 'Hi! If you like this site please consider supporting me on patreon by clicking here!'
    })
*/
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

router.get('/sitemap.xml', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Content-Type', 'application/xml')
  res.end(sitemap)
})

router.get('/railmap', (req, res) => {
  res.render('rail-map', { mapSVG })
})

router.get('/about', (req, res) => {
  res.render('about', { buildNumber, buildComment })
})

module.exports = router
module.exports.initDB = initDB
