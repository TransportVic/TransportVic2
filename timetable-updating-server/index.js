require('../utils')

const config = require('../config')
const MainServer = require('./MainServer')

let mainServer = new MainServer()
mainServer.app.listen(config.httpPort)

global.server = mainServer.app

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error

require('./check-for-updates')
