require('../utils')

const config = require('../config.json')
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
mainServer.app.listen(config.httpPort)

global.server = mainServer.app

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error

require('./check-for-updates')
