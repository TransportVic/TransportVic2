const express = require('express')
const bodyParser = require('body-parser')
const compression = require('compression')
const url = require('url')
const path = require('path')
const minify = require('express-minify')
const fs = require('fs')
const uglifyJS = require('uglify-js')

let robots = fs.readFileSync(path.join(__dirname, '../application/static/app-content/robots.txt'))
let sw = fs.readFileSync(path.join(__dirname, '../application/static/app-content/sw.js'))

const config = require('../config')

module.exports = class MainServer {
  constructor () {
    this.app = express()
    this.configMiddleware(this.app)
    this.configRoutes(this.app)
  }

  configMiddleware (app) {
    app.use(compression({
      level: 9,
      threshold: 512
    }))

    if (process.NODE_ENV === 'prod') app.use(minify({
      uglifyJsModule: uglifyJS,
      errorHandler: console.log
    }))

    app.use('/static', express.static(path.join(__dirname, '../application/static')))

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
    app.get('/sw.js', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Content-Type', 'application/javascript')
      res.end(sw)
    })

    app.get('/robots.txt', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Content-Type', 'text/plain')
      res.end(robots)
    })

    app.get('/log', (req, res) => {
      res.json(global.gtfsUpdaterLog)
    })

    app.get('/home-banner', (req, res) => {
      res.json({
        link: '#',
        alt: 'Maintenance',
        text: 'Site is currently under maintenance...'
      })
    })

    app.use((req, res) => {
      res.status(503).render('errors/updating-in-progress')
    })
  }
}
