const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null

const cheerio = require('cheerio')

const fs = require('fs')
const async = require('async')
let data = fs.readFileSync('load-gtfs/vline-trains/all-vline-stations.xml').toString().replace(/a:/g, '')
const $ = cheerio.load(data)

const completedStations = []

const stations = Array.from($('Location')).filter(location => {
  return $('StopType', location).text() === 'Station'
}).map(location => {
  const vnetStationName = $('LocationName', location).text()
  const stationName = vnetStationName.replace(/^Melbourne[^\w]+/, '').replace(/\(.+\)/g, '')
    .replace(/: .+/, '').replace(/Station.*/, '').replace(/Railway.*/, '').replace(/  +/, ' ')
    .trim() + ' Railway Station'
  if (completedStations.includes(stationName)) return null

  completedStations.push(stationName)
  return {
    name: stationName,
    vnetStationName
  }
}).filter(Boolean)

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')

  await async.forEach(stations, async stop => {
    let stopData = await stops.findDocument({ stopName: stop.name })

    let index = stopData.bays.indexOf(stopData.bays.filter(bay => bay.mode === 'regional train')[0])
    stopData.bays[index].vnetStationName = stop.vnetStationName

    await stops.updateDocument({ stopName: stop.name }, {
      $set: stopData
    })
  })

  console.log('Completed updating ' + stations.length + ' V/Line stop VNET names')
  process.exit()
})
