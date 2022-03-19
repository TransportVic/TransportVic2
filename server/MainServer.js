const express = require('express')
const bodyParser = require('body-parser')
const compression = require('compression')
const url = require('url')
const path = require('path')
const minify = require('express-minify')
const fs = require('fs')
const uglifyEs = require('uglify-es')
const rateLimit = require('express-rate-limit')
const fetch = require('node-fetch')
const utils = require('../utils')
const ptvAPI = require('../ptv-api')

const DatabaseConnection = require('../database/DatabaseConnection')

const config = require('../config.json')
const modules = require('../modules.json')

if (modules.tracker && modules.tracker.bus) {
  require('../modules/trackers/ptv-bus')
  require('../modules/trackers/bus')
}

if (modules.tracker && modules.tracker.tram)
  require('../modules/trackers/tram')

if (modules.tracker && modules.tracker.vline)
  require('../modules/trackers/vline')

if (modules.tracker && modules.tracker['vline-r'])
  require('../modules/trackers/vline-realtime')

if (modules.tracker && modules.tracker.xpt)
  require('../modules/xpt/xpt-updater')

if (modules.tracker && modules.tracker.hcmt)
  require('../modules/trackers/hcmt')

if (modules.tracker && modules.tracker.metro)
  require('../modules/trackers/metro')

if (modules.tracker && modules.tracker.metroTrips)
  require('../modules/trackers/metro-trips')

if (modules.tracker && modules.tracker.metroRaceTrains)
  require('../modules/trackers/metro-race-trains')

if (modules.tracker && modules.tracker.metroNotify)
  require('../modules/trackers/metro-notify')

if (modules.tracker && modules.tracker.metroShunts)
  require('../modules/trackers/metro-shunts')

if (modules.preloadCCL)
  require('../modules/preload-ccl')

if (modules.gtfsr && modules.gtfsr.metro)
  require('../modules/gtfsr/metro')

require('../modules/trackers/discord-notify')

let serverStarted = false

let trackerAuth = 'Basic ' + Buffer.from(config.vlineLogin).toString('base64')

module.exports = class MainServer {
  constructor () {
    this.app = express()
    this.app.use((req, res, next) => {
      if (serverStarted) return next()
      else res.type('text').end('Server starting, please wait...')
    })
    this.initDatabaseConnection(this.app, () => {
      serverStarted = true
      this.configMiddleware(this.app)
      this.configRoutes(this.app)
    })
  }

  initDatabaseConnection (app, callback) {
    this.database = new DatabaseConnection(config.databaseURL, config.databaseName)
    this.database.connect(async err => {
      app.use((req, res, next) => {
        res.db = this.database
        next()
      })

      callback()
    })
  }

  getAverageResponseTime() {
    let counts = this.past50ResponseTimes.length
    let sum = this.past50ResponseTimes.reduce((a, b) => a + b, 0)
    let average = sum / counts

    return average
  }

  configMiddleware (app) {
    this.past50ResponseTimes = []

    app.use((req, res, next) => {
      let reqURL = req.url + ''
      let start = +new Date()

      let endResponse = res.end
      res.end = (x, y, z) => {
        endResponse.bind(res, x, y, z)()
        let end = +new Date()
        let diff = end - start

        if (!reqURL.startsWith('/static/')) {
          global.loggers.http.info(`${req.method} ${reqURL}${res.loggingData ? ` ${res.loggingData}` : ''} ${diff}`)

          this.past50ResponseTimes = [...this.past50ResponseTimes.slice(-49), diff]
        }
      }

      next()
    })

    app.use(compression({
      level: 9,
      threshold: 512
    }))

    if (!config.devMode) {
      app.use(minify({
        uglifyJsModule: uglifyEs,
        errorHandler: console.log
      }))
    }

    function filter(prefix, req, next) {
      let host = req.headers.host || ''
      if (host.includes(prefix)) return true
      else return void next()
    }

    app.get('/', (req, res, next) => {
      if (filter('seized.', req, next)) res.render('seized')
    })

    app.use('/static', express.static(path.join(__dirname, '../application/static'), {
      maxAge: 1000 * 60 * 60 * 24
    }))

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())
    app.use(bodyParser.text())

    app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000')

      res.setHeader('X-Xss-Protection', '1; mode=block')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-Download-Options', 'noopen')

      res.setHeader('Referrer-Policy', 'no-referrer')
      res.setHeader('Feature-Policy', "geolocation 'self'; document-write 'none'; microphone 'none'; camera 'none';")

      next()
    })

    app.set('views', path.join(__dirname, '../application/views'))
    app.set('view engine', 'pug')
    if (process.NODE_ENV && process.NODE_ENV === 'prod') { app.set('view cache', true) }
    app.set('x-powered-by', false)
    app.set('strict routing', false)

    app.use(config.newVlineTracker, (req, res, next) => {
      if (req.headers.authorization && req.headers.authorization === trackerAuth) {
        return next()
      }

      res.status(401)
      res.header('www-authenticate', 'Basic realm="password needed"')
      res.end('Please login')
    })

    app.use(config.newVlineTracker, require('../application/routes/tracker/VLineTracker2'))

    app.use('/bus/timings', rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 60
    }))
  }

  async configRoutes (app) {
    let routers = {
      'mockups/PIDSView': {
        path: '/',
        enable: modules.mockups && modules.mockups.pidsview
      },

      Index: '/',
      IndexData: '/',
      AdditionalLinks: '/links',
      Search: '/search',
      StopsNearby: '/nearby',

      PublicHolidayInfo: '/public-holiday',

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
      'run-pages/Tram': '/tram/run',
      'run-pages/Bus': '/bus/run',
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
      // 'mockups/sss/SouthernCross': '/mockups/sss',
      'mockups/train/TrainPID': '/mockups/train',

      'mockups/sss-new/SSSNew': '/mockups/sss-new',
      'mockups/sss-new/SSSPlatform': '/mockups/sss-new/platform',
      'mockups/sss-new/SSSCoachBay': '/mockups/sss-new/coach',

      'jmss-screens/BigScreen': {
        path: '/jmss-screens/big-screen',
        enable: modules.jmssScreen
      },

      SmartrakIDs: '/smartrak',

      'tracker/BusTracker': '/bus/tracker',
      'tracker/TramTracker': '/tram/tracker',
      'tracker/VLineTracker': '/vline/tracker',
      'tracker/MetroTracker': '/metro/tracker',
      'tracker/MetroNotify': '/metro/notify',

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
      },

      RoutePaths: '/route-paths',
      MetroMap: '/metro/map',
      ChatbotTest: {
        path: '/lxra-map',
        enable: modules.lxraMap
      }
    }

    Object.keys(routers).forEach(routerName => {
      try {
        let routerData = routers[routerName]
        if (routerData.path && !routerData.enable) {
          return global.loggers.general.info('Module', routerName, 'has been disabled')
        }

        let routerPath = routerData.path || routerData

        let router = require(`../application/routes/${routerName}`)
        app.use(routerPath, router)
        if (router.initDB) router.initDB(this.database)
      } catch (e) {
        global.loggers.error.err('Error registering', routerName, e)
      }
    })

    app.get('/response-stats', (req, res) => {
      res.json({
        status: 'ok',
        meanResponseTime: this.getAverageResponseTime(),
        ptvMeanResponseTime: ptvAPI.getAverageResponseTime(),
        ptvFaultRate: ptvAPI.getFaultRate()
      })
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
        global.loggers.error.err(req.url, err)
      }
    })
  }
}
