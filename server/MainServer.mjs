import express from 'express'
import createServer from '@transportme/server-template'
import bodyParser from 'body-parser'
import compression from 'compression'
import url from 'url'
import path from 'path'
import minify from 'express-minify'
import fs from 'fs'
import uglifyJS from 'uglify-js'
import utils from '../utils.js'
import ptvAPI from '../ptv-api.js'
import rateLimit from 'express-rate-limit'

import DatabaseConnection from '../database/DatabaseConnection.js'

import config from '../config.json' with { type: 'json' }
import modules from '../modules.json' with { type: 'json' }
import MongoDatabaseConnection from '../database/mongo/MongoDatabaseConnection.js'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

if (modules.tracker && modules.tracker.bus) await import('../modules/trackers/bus.js')

if (modules.tracker && modules.tracker.busMinder) await import('../modules/trackers/busminder.js')

if (modules.tracker && modules.tracker.tram) await import('../modules/trackers/tram.js')

if (modules.tracker && modules.tracker.vline) await import('../modules/trackers/vline.js')

if (modules.tracker && modules.tracker['vline-r']) await import('../modules/trackers/vline-realtime.js')

if (modules.tracker && modules.tracker.xpt) await import('../modules/xpt/xpt-updater.js')

let serverStarted = false

export default class MainServer {
  constructor () {
    this.app = createServer(path.join(__dirname, '..', 'application'), {
      appName: 'TransportVic',
      requestEndCallback: (req, res, { time }) => {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress 
        global.loggers.http.info(`${req.method} ${req.urlData.pathname}${res.loggingData ? ` ${res.loggingData}` : ''} ${time} ${ip}`)
      }
    })
  }

  async connectToDatabase() {
    this.database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
    await this.database.connect({})
    this.app.use((req, res, next) => {
      res.db = this.database
      next()
    })
  }

  configMiddleware() {
    let app = this.app

    function filter(prefix, req, next) {
      let host = req.headers.host || ''
      if (host.startsWith(prefix)) return true
      else return void next()
    }
    
    let staticBase = config.staticBase || ''
    app.use((req, res, next) => {
      res.locals.staticBase = staticBase
      if (filter('vic.', req, next)) res.redirect(301, `https://transportvic.me${req.url}`)
    })

    app.get('/static-server', (req, res) => {
      res.setHeader('Cache-Control', 'max-age=604800')
      res.end(staticBase)
    })
  }

  async configRoutes () {
    let app = this.app
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

    app.post('/mockups', rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 10
    }))

    for (let routerName of Object.keys(routers)) {
      try {
        let routerData = routers[routerName]
        if (routerData.path && !routerData.enable) {
          global.loggers.general.info('Module', routerName, 'has been disabled')
          continue
        }

        let routerPath = routerData.path || routerData

        let router = await import(`../application/routes/${routerName}.js`)
        app.use(routerPath, router.default)
        if (router.initDB) router.initDB(this.database)
      } catch (e) {
        global.loggers.error.err('Error registering', routerName, e)
      }
    }

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
