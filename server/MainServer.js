const express = require('express')
const bodyParser = require('body-parser')
const compression = require('compression')
const path = require('path')
const minify = require('express-minify')
const fs = require('fs')

const DatabaseConnection = require('../database/DatabaseConnection')

const config = require('../config.json')
let BusTracker
if (config.busTrackerPath)
  BusTracker = require(path.join(config.busTrackerPath, 'server.js'))

module.exports = class MainServer {
  constructor () {
    this.app = express()
    this.initDatabaseConnection(this.app, () => {
      this.configMiddleware(this.app)
      this.configRoutes(this.app)
    })
  }

  initDatabaseConnection (app, callback) {
    const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
    database.connect((err) => {
      app.use((req, res, next) => {
        res.db = database
        next()
      })

      callback()
    })
  }

  configMiddleware (app) {
    const stream = fs.createWriteStream('/tmp/log.txt', { flags: 'a' })

    app.use((req, res, next) => {
      const reqURL = req.url + ''
      const start = +new Date()

      const endResponse = res.end
      res.end = function (x, y, z) {
        endResponse.bind(res, x, y, z)()
        const end = +new Date()

        const diff = end - start

        if (diff > 5 && !reqURL.startsWith('/static/')) { stream.write(req.method + ' ' + reqURL + (res.loggingData ? ' ' + res.loggingData : '') + ' ' + diff + '\n', () => {}) }
      }

      res.locals.hostname = config.websiteDNSName

      next()
    })

    app.use(compression())
    app.use(minify())

    app.use('/static', express.static(path.join(__dirname, '../application/static')))

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())
    app.use(bodyParser.text())

    app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000')
      let secureDomain = `http${config.useHTTPS ? 's' : ''}://${config.websiteDNSName}:* `
      secureDomain += ' https://*.mapbox.com/'

      res.setHeader('Content-Security-Policy', `default-src blob: data: ${secureDomain}; script-src 'unsafe-inline' blob: ${secureDomain}; style-src 'unsafe-inline' ${secureDomain}; img-src: 'unsafe-inline' ${secureDomain}`)
      res.setHeader('X-Frame-Options', 'SAMEORIGIN')
      res.setHeader('X-Xss-Protection', '1; mode=block')
      res.setHeader('X-Content-Type-Options', 'nosniff')

      res.setHeader('Referrer-Policy', 'no-referrer')
      res.setHeader('Feature-Policy', "geolocation 'self'; document-write 'none'; microphone 'none'; camera 'none';")

      next()
    })

    app.set('views', path.join(__dirname, '../application/views'))
    app.set('view engine', 'pug')
    if (process.env['NODE_ENV'] && process.env['NODE_ENV'] === 'prod') { app.set('view cache', true) }
    app.set('x-powered-by', false)
    app.set('strict routing', false)
  }

  configRoutes (app) {
    const routers = {
      Index: '/',
      Search: '/search',
      'timing-pages/VLine': '/vline/timings',
      'timing-pages/MetroTrains': '/metro/timings',

      GeoJSONVisualiser: '/geojson-visualise',

      'mockups/FlindersStreetEscalator': '/mockups/fss-escalator'
    }

    Object.keys(routers).forEach(routerName => {
      const router = require(`../application/routes/${routerName}`)
      app.use(routers[routerName], router)
    })

    if (BusTracker) {
      app.use('/tracker', BusTracker)
    }

    // app.get('/sw.js', (req, res) => {
    //     res.setHeader('Cache-Control', 'no-cache');
    //     res.sendFile(path.join(__dirname, '../application/static/app-content/sw.js'));
    // });

    app.use('/500', (req, res) => { throw new Error('500') })

    app.use((req, res, next) => {
      next(new Error('404'))
    })

    app.use((err, req, res, next) => {
      if (err.message === '404') {
        res.render('error', { code: 404 })
      } else {
        res.render('error', { code: 500 })

        if (process.env['NODE_ENV'] !== 'prod') {
          console.log(err)
        }
      }
    })
  }
}
