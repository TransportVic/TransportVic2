global.startTime = +new Date()

import _utils from './utils.js'
import config from './config.json' with { type: 'json' }
import MainServer from './server/MainServer.mjs'
import startVLineMailServer from './modules/vline-mail/index.js'
import _loggers from './init-loggers.mjs'
import modules from './modules.json' with { type: 'json' }

let mainServer = new MainServer()
await mainServer.connectToDatabase()

mainServer.configMiddleware()
await mainServer.configRoutes()

mainServer.app.listen(config.httpPort)

global.loggers.general.info('Server Started')

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

if (modules.vlineMail) startVLineMailServer()

console.err = console.error