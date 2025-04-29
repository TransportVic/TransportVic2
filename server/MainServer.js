const express = require('express')
const bodyParser = require('body-parser')
const compression = require('compression')
const url = require('url')
const path = require('path')
const minify = require('express-minify')
const fs = require('fs')
const uglifyJS = require('uglify-js')
const utils = require('../utils')
const ptvAPI = require('../ptv-api')

const DatabaseConnection = require('../database/DatabaseConnection')

const config = require('../config')
const modules = require('../modules')

if (modules.tracker && modules.tracker.bus)
  require('../modules/trackers/bus')

if (modules.tracker && modules.tracker.busMinder)
  require('../modules/trackers/busminder')

if (modules.tracker && modules.tracker.tram)
  require('../modules/trackers/tram')

if (modules.tracker && modules.tracker.vline)
  require('../modules/trackers/vline')

if (modules.tracker && modules.tracker['vline-r'])
  require('../modules/trackers/vline-realtime')

if (modules.tracker && modules.tracker.xpt)
  require('../modules/xpt/xpt-updater')

if (modules.tracker && modules.tracker.metro)
  require('../modules/trackers/metro')

if (modules.tracker && modules.tracker.metroTrips) {
  require('../modules/trackers/metro-trips')
  require('../modules/trackers/metro-ccl')
}

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

let serverStarted = false

let trackerAuth = config.metroLogins.map(login => 'Basic ' + Buffer.from(login).toString('base64'))

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

  configMiddleware (app) {
    app.use((req, res, next) => {
      let reqURL = req.url + ''
      let start = +new Date()

      let endResponse = res.end
      res.end = (x, y, z) => {
        endResponse.bind(res, x, y, z)()
        let end = +new Date()
        let diff = end - start

        if (!reqURL.startsWith('/static/')) {
          let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress 
          global.loggers.http.info(`${req.method} ${reqURL}${res.loggingData ? ` ${res.loggingData}` : ''} ${diff} ${ip}`)
        }
      }

      next()
    })

    app.use(compression({
      level: 9,
      threshold: 512
    }))

    if (process.env['NODE_ENV'] === 'prod') app.use(minify({
      uglifyJsModule: uglifyJS,
      errorHandler: console.log
    }))

    function filter(prefix, req, next) {
      let host = req.headers.host || ''
      if (host.startsWith(prefix)) return true
      else return void next()
    }

    app.use((req, res, next) => {
      if (filter('vic.', req, next)) res.redirect(301, `https://transportvic.me${req.url}`)
    })

    app.use('/static', express.static(path.join(__dirname, '../application/static'), {
      maxAge: 1000 * 60 * 60 * 24
    }))

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())
    app.use(bodyParser.text())

    let staticBase = config.staticBase || ''
    app.get('/static-server', (req, res) => {
      res.setHeader('Cache-Control', 'max-age=604800')
      res.end(staticBase)
    })

    app.use((req, res, next) => {
      res.locals.staticBase = staticBase

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
    if (process.NODE_ENV === 'prod') app.set('view cache', true)
    app.set('x-powered-by', false)
    app.set('strict routing', false)
  }

  async configRoutes (app) {
    // app.use('/metro/tracker', (req, res, next) => {
    //   if (req.headers.authorization) {
    //     res.loggingData = `${Buffer.from((req.headers.authorization || '').slice(6), 'base64').toString('utf-8')} ${req.headers['user-agent']}`
    //     if (trackerAuth.includes(req.headers.authorization)) return next()
    //   }
    //
    //   res.status(401)
    //   res.header('www-authenticate', 'Basic realm="password needed"')
    //   res.end('Please login')
    // })

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
      'tracker/BusMinderTracker': '/bus/tracker/busminder',
      'tracker/TramTracker': '/tram/tracker',
      'tracker/VLineTracker': '/vline/tracker',
      'tracker/MetroTracker': '/metro/tracker',

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
      MetroMap: '/metro/map'
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
