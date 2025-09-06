import createServer from '@transportme/server-template'
import url from 'url'
import path from 'path'
import _loggers from '../init-loggers.mjs'
import ptvAPI from '../ptv-api.js'
import rateLimit from 'express-rate-limit'
import routes from '../application/route-data.mjs'

import config from '../config.json' with { type: 'json' }
import modules from '../modules.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import utils from '../utils.js'

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
        global.loggers.http.info(`${req.method} ${req.urlData.protocol}://${req.urlData.host}${req.urlData.pathname}${res.loggingData ? ` ${res.loggingData}` : ''} ${time} ${req.ip}`)
      }
    })
  }

  async connectToDatabase() {
    this.database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
    // this.database.enableDebugging(o => console.log(o))
    // this.database.enableDebugging((o, _, s) => !utils.inspect(o) && console.log(s))

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
      if (req.url.includes('tracker') && req.ip.includes('::ffff:47.79')) return req.status(400).end('Blocked')
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

    let routePromises = []
    for (let routeData of routes) {
      if (routeData.enable === false) {
        global.loggers.general.info(`${routeData.router} has been disabled`)
        continue
      }

      routePromises.push(new Promise(async resolve => {
        try {
          let router = (await import(path.join(__dirname, '..', 'application', 'routes', routeData.router))).default
          resolve({ ...routeData, router })
        } catch (e) {
          console.error('Encountered an error loading', routeData, e)
          resolve(null)
        }
      }))
    }

    let routers = await Promise.all(routePromises)
    for (let router of routers.filter(Boolean)) {
      app.use(router.path, router.router)
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
