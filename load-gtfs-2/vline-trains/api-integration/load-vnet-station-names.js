const fs = require('fs')
const async = require('async')
const path = require('path')
const cheerio = require('cheerio')
const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config.json')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = null

const updateStats = require('../../utils/stats')

let data = fs.readFileSync(path.join(__dirname, 'all-vline-stations.xml')).toString().replace(/a:/g, '')
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
}).map(location => {
  const vnetStationName = $('LocationName', location).text().trim()
  const stationName = vnetStationName.replace(/^Melbourne[^\w]+/, '').replace(/\(.+\)/g, '')
    .replace(/: .+/, '').replace(/Station.*/, '').replace(/Railway.*/, '')
    .replace(/  +/, ' ').trim() + ' Railway Station'

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

    let vlinePlatform = stopData.bays.find(bay => bay.mode === 'regional train')
    vlinePlatform.vnetStationName = stop.vnetStationName

    await stops.updateDocument({ stopName: stop.name }, {
      $set: stopData
    })
  })

  await updateStats('vnet-stop-names', stations.length)
  console.log('Completed updating ' + stations.length + ' V/Line stop VNET names')
  process.exit()
})
