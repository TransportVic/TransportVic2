global.startTime = +new Date()
require('./utils')

const config = require('./config.json')
const HTTPServer = require('./server/HTTPServer')
const HTTPSServer = require('./server/HTTPSServer')
const HTTPSRedirectServer = require('./server/HTTPSRedirectServer')
const MainServer = require('./server/MainServer')

const WebsocketServer = require('./server/WebsocketServer')

const Logger = require('./Logger')
const path = require('path')

global.loggers = {
  http: new Logger(path.join(__dirname, 'logs', 'http'), 'HTTP'),
  mail: new Logger(path.join(__dirname, 'logs', 'mail'), 'MAIL'),
  fetch: new Logger(path.join(__dirname, 'logs', 'fetch'), 'FETCH'),
  trackers: {
    bus: new Logger(path.join(__dirname, 'logs', 'trackers', 'bus'), 'BUS'),
    tram: new Logger(path.join(__dirname, 'logs', 'trackers', 'tram'), 'TRAM'),
    vline: new Logger(path.join(__dirname, 'logs', 'trackers', 'vline'), 'VLINE'),
    vlineR: new Logger(path.join(__dirname, 'logs', 'trackers', 'vline-realtime'), 'VLINE-R'),
    metro: new Logger(path.join(__dirname, 'logs', 'trackers', 'metro'), 'METRO'),
    xpt: new Logger(path.join(__dirname, 'logs', 'trackers', 'xpt'), 'XPT'),
  },
  mockups: new Logger(path.join(__dirname, 'logs', 'mockups'), 'MOCKUPS'),
  error: new Logger(path.join(__dirname, 'logs', 'errors'), 'ERROR'),
  general: new Logger(path.join(__dirname, 'logs', 'general'), 'GENERAL'),
  certs: new Logger(path.join(__dirname, 'logs', 'certs'), 'CERTS')
}

require('./modules/vline-mail')

let httpServer = null
let httpsServer = null
let mainServer = new MainServer()

if (config.useHTTPS) {
  let redirectServer = new HTTPSRedirectServer()
  httpServer = HTTPServer.createServer(redirectServer)

  httpsServer = HTTPSServer.createServer(mainServer, config.sslCerts)
} else {
  httpServer = HTTPServer.createServer(mainServer)
}

let websocketServer = WebsocketServer.createServer(httpsServer || httpServer)

httpServer.listen(config.httpPort)
if (httpsServer) httpsServer.listen(443)

global.loggers.general.info('Server Started')

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error
