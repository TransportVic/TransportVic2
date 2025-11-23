import createServer from '@transportme/server-template'
import os from 'os'
import url from 'url'
import path from 'path'
import _loggers from '../init-loggers.mjs'
import rateLimit from 'express-rate-limit'
import routes from '../application/route-data.mjs'
import config from '../config.json' with { type: 'json' }
import modules from '../modules.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const hostname = os.hostname()

if (modules.tracker && modules.tracker.tram) await import('../modules/trackers/tram.js')

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
    this.tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
    // this.database.enableDebugging(o => console.log(o))
    // this.database.enableDebugging((o, _, s) => !utils.inspect(o) && console.log(s))

    await this.database.connect({})
    await this.tripDatabase.connect({})

    this.app.use((req, res, next) => {
      res.db = this.database
      res.tripDB = this.tripDatabase

      next()
    })
  }

  configMiddleware() {
    let app = this.app

    let staticBase = config.staticBase || ''
    app.use((req, res, next) => {
      res.locals.staticBase = staticBase
      res.setHeader('Served-By', hostname)

      const allowedOrigins = "'self' static.transportvic.me static.cloudflareinsights.com"
      res.setHeader('Content-Security-Policy', `script-src ${allowedOrigins};
        img-src ${allowedOrigins} api.mapbox.com;
        frame-src 'self';
      `.replaceAll(/\n +/g, ' ').trim())

      // Plenty of inline styling still used, disable for now
      // style-src ${allowedOrigins};

      if (req.url.includes('tracker') && req.ip.includes('::ffff:47.79')) return req.status(400).end('Blocked')

      next()
    })

    app.get('/static-server', (req, res) => {
      res.setHeader('Cache-Control', 'max-age=604800')
      res.end(staticBase)
    })
  }

  async configRoutes() {
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
          let routerData = await import(path.join(__dirname, '..', 'application', 'routes', routeData.router))
          if (routerData.initDB) routerData.initDB(this.database, this.tripDatabase)

          let router = routerData.default
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
