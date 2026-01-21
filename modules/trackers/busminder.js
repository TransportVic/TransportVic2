const config = require('../../config')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils.mjs')
const async = require('async')
const schedule = require('./scheduler')
const busMinderRoutes = require('../../additional-data/busminder/busminder-routes')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let busMinderBuses

let validRoutes = busMinderRoutes.map(route => route.routeID)

async function requestData() {
  let busData = JSON.parse(await utils.request(urls.venturaBusMinderLocations, {
    headers: {
      'Host': 'maps.busminder.com.au',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:100.0) Gecko/20100101 Firefox/100.0',
      'Referer': urls.venturaBusMinder
    }
  }))

  let timestamp = +new Date()

  let validBuses = busData.filter(bus => validRoutes.includes(bus.tid) && bus.registration.match(/\d/))
  let toUpdate = validBuses.map(bus => {
    let route = busMinderRoutes.find(route => route.routeID === bus.tid)

    return {
      id: bus.id,
      fleet: 'V' + bus.registration.match(/(\d+)/)[1],
      routeNumber: route.routeNumber,
      routeDestination: route.routeDestination,
      timestamp
    }
  })

  let bulkOperations = toUpdate.map(bus => {
    return {
      replaceOne: {
        filter: { id: bus.id },
        replacement: bus,
        upsert: true
      }
    }
  })

  await busMinderBuses.bulkWrite(bulkOperations)
}

database.connect(async () => {
  busMinderBuses = database.getCollection('busminder buses')
  schedule([
    [0, 60, 2],
    [60, 299, 1.5],
    [300, 1260, 1],
    [1261, 1440, 1.5]
  ], requestData, 'busminder tracker', global.loggers.oldTrackers.bus)
})
