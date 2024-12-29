const fs = require('fs')
const async = require('async')
const path = require('path')
const cheerio = require('cheerio')
const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let stops = null

let data = fs.readFileSync(path.join(__dirname, 'all-vline-stations.xml')).toString().replace(/a:/g, '')
const $ = cheerio.load(data)

const completedStations = []
const coachOverrides = [
  'Nhill: Station',
  'Dimboola Station',
  'Stawell Station',
  'Horsham Station',
  'Werribee Station'
]

const stations = Array.from($('Location')).filter(location => {
  let locationType = $('StopType', location).text()
  let locationName = $('LocationName', location).text().trim()

  return locationType === 'Station' || coachOverrides.includes(locationName)
}).map(location => {
  let vnetStationName = $('LocationName', location).text().trim()
  let stationName = vnetStationName.replace(/^Melbourne[^\w]+/, '').replace(/\(.+\)/g, '')
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
    if (!stopData) return console.log(`Load VNet Names: Skipping ${stop.name}`)

    let vlinePlatform = stopData.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)
    if (!vlinePlatform) return console.log(`Load VNet Names: Skipping ${stop.name}`)

    vlinePlatform.vnetStationName = stop.vnetStationName

    await stops.updateDocument({ stopName: stop.name }, {
      $set: stopData
    })
  })

  console.log('Completed updating ' + stations.length + ' V/Line stop VNET names')
  process.exit()
})
