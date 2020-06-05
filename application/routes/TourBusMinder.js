const express = require('express')
const utils = require('../../utils')
const router = new express.Router()

const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let maxTripTimeout = 1000 * 60 * 10 // 10min

router.get('/', (req, res) => {
  res.render('tourbusminder/index')
})

router.get('/client', (req, res) => {
  res.render('tourbusminder/client')
})

router.get('/server', (req, res) => {
  res.render('tourbusminder/server')
})

module.exports = router
module.exports.setupWS = async function(wss) {
  await new Promise(r => database.connect({
    poolSize: 100
  }, r))

  let tbmTrips = database.getCollection('tbm trips')

  let serversideConnections = []

  function broadcast(data) {
    serversideConnections.forEach(sconn => {
      sconn.send(JSON.stringify(data))
    })
  }

  wss.on('connection', async (conn, req) => {
    let time = +new Date()

    if (req.url === '/loc/client') {
      conn.on('message', async data => {
        data = JSON.parse(data)

        let {
          rego,
          tripName,
          position,
        } = data

        let date = utils.now().format('YYYYMMDD')

        let query = {
          rego, tripName, date, active: true
        }

        let busData = {
          ...query,
          time,
          position
        }

        let trip = await tbmTrips.findDocuments(query).sort({time: -1}).limit(1).next()

        if (trip && time - trip.time < maxTripTimeout) {
          if (data.quit) {
            broadcast({
              quit: {
                rego
              }
            })
            return await tbmTrips.updateDocument({ _id: trip._id }, {
              $set: {
                active: false
              }
            })
          }
          await tbmTrips.updateDocument({ _id: trip._id }, {
            $set: {
              time,
              position
            }
          })
        } else {
          await tbmTrips.createDocument(busData)
        }

        broadcast({
          update: busData
        })
      })
    } else if (req.url === '/loc/server') {
      serversideConnections.push(conn)
      conn.on('close', () => {
        serversideConnections.splice(serversideConnections.indexOf(conn), 1)
      })

      let trips = await tbmTrips.findDocuments({
        time: {
          $gt: time - maxTripTimeout
        },
        active: true
      }).toArray()

      conn.send(JSON.stringify({
        initial: trips
      }))
    }
  })

}
