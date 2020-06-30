global.startTime = +new Date()
require('./utils')

const config = require('./config.json')
const modules = require('./modules.json')
const HTTPServer = require('./server/HTTPServer')
const HTTPSServer = require('./server/HTTPSServer')
const HTTPSRedirectServer = require('./server/HTTPSRedirectServer')
const MainServer = require('./server/MainServer')

const WebsocketServer = require('./server/WebsocketServer')

let httpServer = null
let httpsServer = null
const mainServer = new MainServer()

if (config.useHTTPS) {
  const redirectServer = new HTTPSRedirectServer()
  httpServer = HTTPServer.createServer(redirectServer)

  httpsServer = HTTPSServer.createServer(mainServer, config.sslCertPath)
} else {
  httpServer = HTTPServer.createServer(mainServer)
}

let websocketServer = WebsocketServer.createServer(httpsServer || httpServer)

httpServer.listen(config.httpPort)
if (httpsServer) httpsServer.listen(443)

process.on('uncaughtException', (err) => {
  console.error(new Date() + '  ' + (err && err.stack) ? err.stack : err)
})

console.err = console.error

if (modules.vlineMail)
  require('./modules/health-check')
