const utils = require('../utils')
const ws = require('ws')
const url = require('url')

const TourBusMinder = require('../application/routes/TourBusMinder')

module.exports = {
  createServer: async server => {
    let busminderServer = new ws.Server({ noServer: true })

    server.on('upgrade', (req, socket, head) => {
      const pathname = url.parse(req.url).pathname

      if (pathname === '/loc/client' || pathname === '/loc/server') {
        busminderServer.handleUpgrade(req, socket, head, conn => {
          busminderServer.emit('connection', conn, req)
        })
      } else {
        socket.destroy()
      }
    })

    TourBusMinder.setupWS(busminderServer)

    return busminderServer
  }
}
