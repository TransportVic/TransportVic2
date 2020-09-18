const cheerio = require('cheerio')
const fs = require('fs')
const async = require('async')
const config = require('../../config')
const DatabaseConnection = require('../../database/DatabaseConnection')
const stationCodes = require('../station-codes')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

function getStopGTFSID(stopGTFSID, n) { return stopGTFSID + 500000000 + n * 10000000 }

let stopData = fs.readFileSync(__dirname + '/station-trbs.kml').toString().replace(/<!\[CDATA\[([\s\S]*?)\]\]>(?=\s*<)/gi, "$1")
let $ = cheerio.load(stopData)

let data = {}
let stopCounts = {}

database.connect(async () => {
  let stops = database.getCollection('stops')

  let allStops = Array.from($('Placemark'))
  await async.forEachSeries(allStops, async stopData => {
    let stationCode = $('name', stopData).text().trim()
    let towards = $('Data[name=towards]', stopData).text().trim()
    let along = $('Data[name=along]', stopData).text().trim()
    let bay = $('Data[name=bay]', stopData).text().trim()
    if (bay) bay = `Bay ${bay}`
    else bay = null

    let stationName = stationCodes[stationCode]

    let coordinates = $('coordinates', stopData).text().trim().split(',').slice(0, 2).map(x => parseFloat(x))

    let dbStopData = (await stops.findDocument({
      stopName: `${stationName} Railway Station`
    })).bays.find(stop => stop.mode === 'metro train')

    let stopGeometry = {
      towards,
      location: {
        type: 'Point',
        coordinates: coordinates
      },
      along,
      bayDesignation: bay,
      stopGTFSID: getStopGTFSID(dbStopData.stopGTFSID, (stopCounts[stationName] || 0) + 1)
    }

    if (data[stationName]) {
      data[stationName].push(stopGeometry)
      stopCounts[stationName]++
    } else {
      data[stationName] = [stopGeometry]
      stopCounts[stationName] = 1
    }
  })

  fs.writeFileSync(__dirname + '/../train-replacement-bays.json', JSON.stringify(data, null, 1))
  process.exit()
})
