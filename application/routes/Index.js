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

fs.readFile(path.join(__dirname, '../static/images/interactives/railmap.svg'), (err, data) => {
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

module.exports = router
