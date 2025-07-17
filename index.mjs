global.startTime = +new Date()

import utils from './utils.js'
import config from './config.json' with { type: 'json' }
import MainServer from './server/MainServer.mjs'
import vlineMail from './modules/vline-mail/index.js'

setTimeout(async () => {
  let mainServer = new MainServer()
  await mainServer.connectToDatabase()

  mainServer.configMiddleware()
  mainServer.configRoutes()

  mainServer.app.listen(config.httpPort)

  global.loggers.general.info('Server Started')

  process.on('uncaughtException', err => {
    global.loggers.error.err(err)
  })

  console.err = console.error
}, 100)
