require('../utils')

const config = require('../config')
const MainServer = require('./MainServer')

let mainServer = new MainServer()
global.server = mainServer.app.listen(config.httpPort)

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error

require('./check-for-updates')
