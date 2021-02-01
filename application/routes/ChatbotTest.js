const express = require('express')
const utils = require('../../utils')
const router = new express.Router()
const signalR = require('signalr-client')

let buses = {}
let types = {
  58370: "Limited Express FKN",
  58374: "Stopping All Stations FKN",
  58375: "Stopping All Stations STY"
}

utils.request('https://journey-live-lxrp.mesh-service.com/api/map-data', {
  method: 'POST',
  headers: {
    origin: 'https://journey-live-lxrp.mesh-service.com',
    referer: 'https://journey-live-lxrp.mesh-service.com',
    host: 'journey-live-lxrp.mesh-service.com',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15',
    'content-type': 'application/json',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-site': 'same-site',
  },
  body: JSON.stringify({
    t: "ODQ3IyMjRnJhbmtzdG9u"
  })
}).then(async resp => {
  let key = JSON.parse(resp).data.key

  let client = new signalR.client('wss://maps.busminder.com.au:5031/signalr', ['broadcastHub'], 3, true)
  client.headers['Origin'] = 'http://maps.busminder.com.au'
  client.headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15'
  client.headers['Referer'] = 'http://maps.busminder.com.au/'
  client.headers['Host'] = 'maps.busminder.com.au:5031'
  client.queryString.token = key

  client.serviceHandlers = {
    bound: () => {
      setTimeout(() => {
        client.invoke('broadcasthub', 'LiveFeed')
      }, 2000)
    },
    messageReceived: message => {
      if (message.type === 'utf8') {
        const data = JSON.parse(message.utf8Data)
        if (!(data.M && data.M[0] && data.M[0].A[0])) return

        let bus = JSON.parse(data.M[0].A[0])
        if (!bus.REG) return

        let position = {
          type: "Point",
          coordinates: [
            bus.LT, bus.LG
          ]
        }

        let route = types[bus.TID] || 'On Track'

        let fleetNumber = bus.REG.match(/BS?(\d+)/)
        if (!fleetNumber) return
        fleetNumber = fleetNumber[1]

        buses[fleetNumber] = {
          location: position,
          route
        }
      }
    },
    connectFailed: () => {},
    connected: () => {},
    onerror: console.log,
    disconnected: () => {},
    reconnecting: () => true
  }

  client.start()
})


router.get('/', (req, res) => {
  res.render('lxra-map')
})

router.post('/', (req, res) => {
  res.json(buses)
})

module.exports = router
