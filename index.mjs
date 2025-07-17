global.startTime = +new Date()

import utils from './utils.js'
import config from './config.json' with { type: 'json' }
import MainServer from './server/MainServer.mjs'
import vlineMail from './modules/vline-mail/index.js'

setTimeout(() => {
  let mainServer = new MainServer()
  mainServer.app.listen(config.httpPort)

  global.loggers.general.info('Server Started')

  process.on('uncaughtException', err => {
    global.loggers.error.err(err)
  })

  console.err = console.error
}, 100)
