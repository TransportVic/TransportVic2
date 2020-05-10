const express = require('express')
const bodyParser = require('body-parser')
const compression = require('compression')
const url = require('url')
const path = require('path')
const minify = require('express-minify')
const fs = require('fs')
const uglifyEs = require('uglify-es')

const config = require('../config.json')

module.exports = class MainServer {
  constructor () {
    this.app = express()
    this.configMiddleware(this.app)
    this.configRoutes(this.app)
  }

  configMiddleware (app) {
    app.use(compression())

    app.use(minify({
      uglifyJsModule: uglifyEs,
      errorHandler: console.log
    }))

    app.use('/static', express.static(path.join(__dirname, '../application/static')))

    app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000')
      let secureDomain = `http${config.useHTTPS ? 's' : ''}://${config.websiteDNSName}:* `
      secureDomain += ' https://*.mapbox.com/'

      // res.setHeader('Content-Security-Policy', `default-src blob: data: ${secureDomain}; script-src 'unsafe-inline' blob: ${secureDomain}; style-src 'unsafe-inline' ${secureDomain}; img-src: 'unsafe-inline' ${secureDomain}`)
      res.setHeader('X-Xss-Protection', '1; mode=block')
      res.setHeader('X-Content-Type-Options', 'nosniff')

      res.setHeader('Referrer-Policy', 'no-referrer')
      res.setHeader('Feature-Policy', "geolocation 'self'; document-write 'none'; microphone 'none'; camera 'none';")

      next()
    })

    app.set('views', path.join(__dirname, '../application/views'))
    app.set('view engine', 'pug')
    if (process.env['NODE_ENV'] && process.env['NODE_ENV'] === 'prod') { app.set('view cache', true) }
    app.set('x-powered-by', false)
    app.set('strict routing', false)
  }

  async configRoutes (app) {
    app.get('/sw.js', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(__dirname, '../application/static/app-content/sw.js'))
    })

    app.get('/robots.txt', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(path.join(__dirname, '../application/static/app-content/robots.txt'))
    })

    app.get('/log', (req, res) => {
      res.json(global.gtfsUpdaterLog)
    })

    app.use((req, res) => {
      res.status(503).render('errors/updating-in-progress')
    })
  }
}
