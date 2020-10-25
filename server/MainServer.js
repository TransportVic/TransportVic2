const express = require('express')
const bodyParser = require('body-parser')
const compression = require('compression')
const url = require('url')
const path = require('path')
const minify = require('express-minify')
const fs = require('fs')
const uglifyEs = require('uglify-es')
const rateLimit = require('express-rate-limit')
const utils = require('../utils')

const DatabaseConnection = require('../database/DatabaseConnection')

const config = require('../config.json')
const modules = require('../modules.json')

if (modules.tracker && modules.tracker.bus)
  require('../modules/trackers/bus')

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

if (modules.preloadCCL)
  require('../modules/preload-ccl')

let serverStarted = false

let bandwithFilePath = path.join(__dirname, '../bandwidth.json')
let serverStats = {}
fs.readFile(bandwithFilePath, (err, data) => {
  if (data) {
    serverStats = JSON.parse(data)
  }
})

setInterval(() => {
  fs.writeFile(bandwithFilePath, JSON.stringify(serverStats, null, 2), () => {
  })
}, 1000 * 60)

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
      let date = utils.getYYYYMMDDNow()
      if (!serverStats[date]) serverStats[date] = 0

      let bytes = 200 // Roughly accounting for headers since... they don't show up?
      let {write, end} = res.socket
      res.socket.write = (x, y, z) => {
        write.bind(res.socket, x, y, z)()
        bytes += x.length
      }

      res.socket.end = (x, y, z) => {
        end.bind(res.socket, x, y, z)()
        if (x) bytes += x.length
      }

      let endResponse = res.end
      res.end = (x, y, z) => {
        endResponse.bind(res, x, y, z)()
        let end = +new Date()
        let diff = end - start

        if (diff > 20 && !reqURL.startsWith('/static/')) {
          global.loggers.http.info(`${req.method} ${reqURL}${res.loggingData ? ` ${res.loggingData}` : ''} ${diff} ${bytes}`)

          this.past50ResponseTimes = [...this.past50ResponseTimes.slice(-49), diff]
        }

        serverStats[date] += bytes
      }

      next()
    })

    app.use('/.well-known/acme-challenge/:key', (req, res) => {
      let filePath = path.join(config.webrootPath, req.params.key)
      let stream = fs.createReadStream(filePath)
      stream.pipe(res)

      stream.on('error', err => {
        res.status(404).end('404')
      })
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

    app.use('/static', express.static(path.join(__dirname, '../application/static'), {
      maxAge: 1000 * 60 * 60 * 24
    }))

    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())
    app.use(bodyParser.text())

    app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000')
      let secureDomain = `http${config.useHTTPS ? 's' : ''}://${config.websiteDNSName}:* `
      secureDomain += ' https://*.mapbox.com/'

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

    app.use('/mockups', rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 140
    }))
  }

  async configRoutes (app) {
    let routers = {
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
      'run-pages/Tram': '/tram/run',
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
      'mockups/train/TrainPID': '/mockups/train',

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
        path: '/bus/tracker',
        enable: modules.tracker && modules.tracker.bus
      },
      'tracker/TramTracker': {
        path: '/tram/tracker',
        enable: modules.tracker && modules.tracker.tram
      },
      'tracker/VLineTracker': {
        path: '/vline/tracker',
        enable: modules.tracker && modules.tracker.vline
      },
      'tracker/MetroTracker': {
        path: '/metro/tracker',
        enable: modules.tracker && modules.tracker.metro
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
      },

      RoutePaths: '/route-paths',
      MetroMap: '/metro-map'
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

    app.get('/sw.js', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(__dirname, '../application/static/app-content/sw.js'))
    })

    app.get('/robots.txt', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(__dirname, '../application/static/app-content/robots.txt'))
    })

    app.get('/response-stats', (req, res) => {
      res.json({ status: 'ok', meanResponseTime: this.getAverageResponseTime() })
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
        global.loggers.error.err(err)
      }
    })
  }
}
