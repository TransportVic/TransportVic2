require('../utils')

const config = require('../config.json')
const HTTPServer = require('./HTTPServer')
const HTTPSServer = require('./HTTPSServer')
const HTTPSRedirectServer = require('./HTTPSRedirectServer')
const MainServer = require('./MainServer')

const {exec} = require('child_process')
const request = require('request')

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

httpServer.listen(config.httpPort)
if (httpsServer) httpsServer.listen(443)

process.on('uncaughtException', (err) => {
  console.error(new Date() + '  ' + (err && err.stack) ? err.stack : err)
})

console.err = console.error

require('./check-for-updates')
