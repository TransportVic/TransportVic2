import createServer from '@transportme/server-template'
import url from 'url'
import path from 'path'
import utils from '../utils.js'
import ptvAPI from '../ptv-api.js'
import rateLimit from 'express-rate-limit'
import routers from '../application/route-data.mjs'

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
