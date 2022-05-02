global.startTime = +new Date()
require('./utils')

const config = require('./config.json')
const MainServer = require('./server/MainServer')

require('./modules/vline-mail')

let mainServer = new MainServer()
mainServer.app.listen(config.httpPort)

global.loggers.general.info('Server Started')

process.on('uncaughtException', err => {
  global.loggers.error.err(err)
})

console.err = console.error
