global.startTime = +new Date()
require('./utils')

const config = require('./config.json')
const HTTPServer = require('./server/HTTPServer')
const HTTPSServer = require('./server/HTTPSServer')
const HTTPSRedirectServer = require('./server/HTTPSRedirectServer')
const MainServer = require('./server/MainServer')

const WebsocketServer = require('./server/WebsocketServer')

require('./modules/vline-mail')

let httpServer = null
let httpsServer = null
let mainServer = new MainServer()

if (config.useHTTPS) {
  let redirectServer = new HTTPSRedirectServer()
  httpServer = HTTPServer.createServer(redirectServer)

  httpsServer = HTTPSServer.createServer(mainServer, config.sslCerts)
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
