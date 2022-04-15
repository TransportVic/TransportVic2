require('../utils')

const config = require('../config.json')
const HTTPServer = require('../server/HTTPServer')
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

let mainServer = new MainServer()
let httpServer = HTTPServer.createServer(mainServer)

global.server = hhttpServer

httpServer.listen(config.httpPort)

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error

require('./check-for-updates')
