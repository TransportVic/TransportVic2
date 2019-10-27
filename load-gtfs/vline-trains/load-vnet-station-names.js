const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = null

const cheerio = require('cheerio')
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

const fs = require('fs')
const async = require('async')
let data = fs.readFileSync('load-gtfs/vline-trains/all-vline-stations.xml').toString().replace(/a:/g, '')
const $ = cheerio.load(data)

const completedStations = []
const coachOverrides = [
  'Nhill: Station',
  'Dimboola Station',
  'Stawell Station',
  'Horsham Station'
]

const stations = Array.from($('Location')).filter(location => {
  return $('StopType', location).text() === 'Station'
    || coachOverrides.includes($('LocationName', location).text().trim())
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

  await updateStats('vnet-stop-names', stations.length, new Date() - start)
  console.log('Completed updating ' + stations.length + ' V/Line stop VNET names')
  process.exit()
})
