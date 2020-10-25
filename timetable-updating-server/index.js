require('../utils')

const config = require('../config.json')
const HTTPServer = require('../server/HTTPServer')
const HTTPSServer = require('../server/HTTPSServer')
const HTTPSRedirectServer = require('../server/HTTPSRedirectServer')
const MainServer = require('./MainServer')

const Logger = require('../Logger')
const path = require('path')

global.loggers = {
  http: new Logger(path.join(__dirname, 'logs', 'http'), 'HTTP'),
  fetch: new Logger(path.join(__dirname, 'logs', 'fetch'), 'FETCH'),
  error: new Logger(path.join(__dirname, 'logs', 'errors'), 'ERROR'),
  general: new Logger(path.join(__dirname, 'logs', 'general'), 'GENERAL'),
  certs: new Logger(path.join(__dirname, 'logs', 'certs'), 'CERTS')
}

let httpServer = null
let httpsServer = null
const mainServer = new MainServer()

if (config.useHTTPS) {
  const redirectServer = new HTTPSRedirectServer()
  httpServer = HTTPServer.createServer(redirectServer)

  httpsServer = HTTPSServer.createServer(mainServer, config.sslCerts)
} else {
  httpServer = HTTPServer.createServer(mainServer)
}

global.server = httpsServer || httpServer

httpServer.listen(config.httpPort)
if (httpsServer) httpsServer.listen(443)

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error

require('./check-for-updates')
