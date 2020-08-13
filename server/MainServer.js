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
const modules = require('../modules.json')

if (modules.tracker && modules.tracker.bus)
  require('../modules/bus-seeker')

if (modules.tracker && modules.tracker.vline)
  require('../modules/vline-tracker')

if (modules.preloadCCL)
  require('../modules/preload-ccl')

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

    app.use(compression({
      level: 9
    }))

    if (!config.devMode) {
      app.use(minify({
        uglifyJsModule: uglifyEs,
        errorHandler: console.log
      }))
    }

    app.use('/static', express.static(path.join(__dirname, '../application/static'), {
      maxAge: 31557600
    }))

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
      'mockups/PIDSView': {
        path: '/',
        enable: modules.mockups && modules.mockups.pidsview
      },

      Index: '/',
      AdditionalLinks: '/links',
      Search: '/search',
      StopsNearby: '/nearby',

      'timing-pages/VLine': {
        path: '/vline/timings',
        enable: modules.Next4 && modules.Next4.vline
      },
      'timing-pages/MetroTrains': {
        path: '/metro/timings',
        enable: modules.Next4 && modules.Next4.metro
      },
      'timing-pages/RegionalCoach': {
        path: '/coach/timings',
        enable: modules.Next4 && modules.Next4.coach
      },
      'timing-pages/Bus': {
        path: '/bus/timings',
        enable: modules.Next4 && modules.Next4.bus
      },
      'timing-pages/Tram': {
        path: '/tram/timings',
        enable: modules.Next4 && modules.Next4.tram
      },
      'timing-pages/Ferry': {
        path: '/ferry/timings',
        enable: modules.Next4 && modules.Next4.ferry
      },
      'timing-pages/HeritageTrain': {
        path: '/heritage/timings',
        enable: modules.Next4 && modules.Next4.heritage
      },

      'run-pages/MetroTrains': '/metro/run',
      'run-pages/VLineTrains': '/vline/run',
      'run-pages/Generic': '/',

      Statistics: '/stats',
      TourBusMinder: '/tbm',

      'mockups/Index': '/mockups',
      'mockups/fss/FlindersStreet': '/mockups/fss',
      'mockups/metro-lcd/Concourse-PIDS': '/mockups/metro-lcd/concourse',
      'mockups/metro-lcd/Metro-LCD-PIDS': '/mockups/metro-lcd',
      'mockups/BusInt-PIDS': '/mockups/bus-int-pids',
      'mockups/Metro-LED-PIDS': '/mockups/metro-led-pids',
      'mockups/Metro-CRT-PIDS': '/mockups/metro-crt',
      'mockups/VLine-PIDS': '/mockups/vline',
      'mockups/sss/SouthernCross': '/mockups/sss',

      'mockups/sss-new/SSSNew': '/mockups/sss-new',
      'mockups/sss-new/SSSPlatform': '/mockups/sss-new/platform',
      'mockups/sss-new/SSSCoachBay': '/mockups/sss-new/coach',

      'jmss-screens/BigScreen': {
        path: '/jmss-screens/big-screen',
        enable: modules.jmssScreen
      },

      SmartrakIDs: {
        path: '/smartrak',
        enable: modules.tracker && modules.tracker.bus
      },

      'tracker/BusTracker': {
        path: '/tracker2',
        enable: modules.tracker && modules.tracker.bus
      },
      'tracker/NewBusTracker': {
        path: '/bus/tracker',
        enable: modules.tracker && modules.tracker.bus
      },
      'tracker/VLineTracker': {
        path: '/vline/tracker',
        enable: modules.tracker && modules.tracker.vline
      },

      'route-data/RegionalBusRoute': {
        path: '/bus/route/regional',
        enable: modules.routes && modules.routes.bus
      },
      'route-data/NamedBusRoute': {
        path: '/bus/route/named',
        enable: modules.routes && modules.routes.bus
      },
      'route-data/MetroBusRoute': {
        path: '/bus/route',
        enable: modules.routes && modules.routes.bus
      },

      'route-data/TramRoute': {
        path: '/tram/route',
        enable: modules.routes && modules.routes.tram
      },

      'route-data/MetroRoute': {
        path: '/metro/line',
        enable: modules.routes && modules.routes.metro
      },

      'route-data/VLineRoute': {
        path: '/vline/line',
        enable: modules.routes && modules.routes.vline
      },

      StopPreview: {
        path: '/stop-preview',
        enable: modules.stopPreview
      },

      RoutePreview: {
        path: '/route-preview',
        enable: modules.routePreview
      }
    }

    Object.keys(routers).forEach(routerName => {
      try {
        let routerData = routers[routerName]
        if (routerData.path && !routerData.enable) return console.log('Module', routerName, 'disabled, skipping it. This does not check for cross dependencies on GTFS data')

        let routerPath = routerData.path || routerData

        let router = require(`../application/routes/${routerName}`)
        app.use(routerPath, router)
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
