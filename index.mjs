global.startTime = +new Date()

import _utils from './utils.js'
import config from './config.json' with { type: 'json' }
import MainServer from './server/MainServer.mjs'
import _vlineMail from './modules/vline-mail/index.js'
import _loggers from './init-loggers.mjs'

let mainServer = new MainServer()
await mainServer.connectToDatabase()

mainServer.configMiddleware()
await mainServer.configRoutes()

mainServer.app.listen(config.httpPort)

global.loggers.general.info('Server Started')

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error