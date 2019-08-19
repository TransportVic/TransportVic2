const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let vlineRailwayStations = null

const cheerio = require('cheerio')

const fs = require('fs')
const async = require('async')
let data = fs.readFileSync('load_gtfs/all_vline_stations.xml').toString()
data = data.replace(/a:/g, '')
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
    stationName,
    vnetStationName
  }
}).filter(Boolean)

database.connect({
  poolSize: 100
}, async err => {
  vlineRailwayStations = database.getCollection('vline railway stations')
  await async.map(stations, async station => {
    await vlineRailwayStations.updateDocument({ stationName: station.stationName }, {
      $set: {
        vnetStationName: station.vnetStationName
      }
    })
  })

  console.log('Completed updating ' + stations.length + ' V/Line station VNET names')
  process.exit()
})
