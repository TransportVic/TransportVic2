const express = require('express')
const bodyParser = require('body-parser')
const compression = require('compression')
const url = require('url')
const path = require('path')
const minify = require('express-minify')
const fs = require('fs')
const uglifyEs = require('uglify-es')

const DatabaseConnection = require('../database/DatabaseConnection')

const config = require('../config.json')

if (config.seekBuses)
  require('../modules/bus-seeker')

if (config.trackVline)
  require('../modules/vline-tracker')

module.exports = class MainServer {
  constructor () {
    this.app = express()
    this.initDatabaseConnection(this.app, () => {
      this.configMiddleware(this.app)
      this.configRoutes(this.app)
    })
  }

  initDatabaseConnection (app, callback) {
    const database = new DatabaseConnection(config.databaseURL, config.databaseName)
    database.connect(async err => {
      app.use((req, res, next) => {
        res.db = database
        next()
      })

      callback()
    })
  }

  configMiddleware (app) {
    const stream = fs.createWriteStream('/tmp/log.txt', { flags: 'a' })
    let excludedURLs = []

    app.use((req, res, next) => {
      const reqURL = req.url + ''
      const start = +new Date()

      const endResponse = res.end
      res.end = function (x, y, z) {
        endResponse.bind(res, x, y, z)()
        const end = +new Date()

        const diff = end - start

        if (diff > 5 && !reqURL.startsWith('/static/') && !excludedURLs.includes(reqURL)) {
          stream.write(`${req.method} ${reqURL} ${res.loggingData} ${diff}\n`, () => {})
        }
      }

      res.locals.hostname = config.websiteDNSName

      next()
    })

    app.use(compression())

    if (!config.devMode)
      app.use(minify({
        uglifyJsModule: uglifyEs,
        errorHandler: console.log
      }))

    app.use('/static', express.static(path.join(__dirname, '../application/static')))

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())
    app.use(bodyParser.text())

    app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000')
      let secureDomain = `http${config.useHTTPS ? 's' : ''}://${config.websiteDNSName}:* `
      secureDomain += ' https://*.mapbox.com/'

      // res.setHeader('Content-Security-Policy', `default-src blob: data: ${secureDomain}; script-src 'unsafe-inline' blob: ${secureDomain}; style-src 'unsafe-inline' ${secureDomain}; img-src: 'unsafe-inline' ${secureDomain}`)
      res.setHeader('X-Xss-Protection', '1; mode=block')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Download-Options', 'noopen')

      res.setHeader('Referrer-Policy', 'no-referrer')
      res.setHeader('Feature-Policy', "geolocation 'self'; document-write 'none'; microphone 'none'; camera 'none';")

      next()
    })

    app.set('views', path.join(__dirname, '../application/views'))
    app.set('view engine', 'pug')
    if (process.env['NODE_ENV'] && process.env['NODE_ENV'] === 'prod') { app.set('view cache', true) }
    app.set('x-powered-by', false)
    app.set('strict routing', false)

    app.use((req, res, next) => {
      if (req.url.startsWith('/.well-known')) {
        try {
          let reqURL = new url.URL('https://transportsg.me' + req.url)
          const filePath = path.join(config.webrootPath, reqURL.pathname)

          fs.createReadStream(filePath).pipe(res)

          return
        } catch (e) {console.log(e)
        }
      }
      next()
    })
  }

  async configRoutes (app) {
    const routers = {
      'mockups/PIDSView': '/',

      Index: '/',
      Search: '/search',
      StopsNearby: '/nearby',

      'timing-pages/VLine': '/vline/timings',
      'timing-pages/MetroTrains': '/metro/timings',
      'timing-pages/RegionalCoach': '/coach/timings',
      'timing-pages/Bus': '/bus/timings',
      'timing-pages/Tram': '/tram/timings',
      'timing-pages/Ferry': '/Ferry/timings',

      'run-pages/MetroTrains': '/metro/run',
      'run-pages/VLineTrains': '/vline/run',
      'run-pages/Generic': '/',

      SmartrakIDs: '/smartrak',
      Statistics: '/stats',
      TourBusMinder: '/tbm',

      'mockups/Index': '/mockups',
      'mockups/FlindersStreet': '/mockups/fss',
      'mockups/Metro-LCD-PIDS': '/mockups/metro-lcd-pids',
      'mockups/BusInt-PIDS': '/mockups/bus-int-pids',
      'mockups/Metro-LED-PIDS': '/mockups/metro-led-pids',
      'mockups/SouthernCross': '/mockups/sss',

      'mockups/sss-new/SSSNew': '/mockups/sss-new',
      'mockups/sss-new/SSSCoachBay': '/mockups/sss-new/coach',

      'jmss-screens/BigScreen': '/jmss-screens/big-screen',

      'tracker/BusTracker': '/tracker2',
      'tracker/VLineTracker': '/vline/tracker',

      'route-data/MetroBusRoute': '/bus/route',
      'route-data/RegionalBusRoute': '/bus/route/regional/',

      StopPreview: '/stop-preview'
    }

    Object.keys(routers).forEach(routerName => {
      try {
        const router = require(`../application/routes/${routerName}`)
        app.use(routers[routerName], router)
      } catch (e) {
        console.err('Error registering', routerName, e)
      }
    })

    app.get('/sw.js', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(__dirname, '../application/static/app-content/sw.js'))
    })

    app.get('/robots.txt', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(__dirname, '../application/static/app-content/robots.txt'))
    })

    app.use('/500', (req, res) => { throw new Error('500') })

    app.use((req, res, next) => {
      next(new Error('404'))
    })

    app.use((err, req, res, next) => {
      if (err.message === '404') {
        res.status(404).render('errors/404')
      } else {
        res.status(500).render('errors/500')

        if (process.env['NODE_ENV'] !== 'prod') {
          console.log(err)
        }
      }
    })
  }
}
