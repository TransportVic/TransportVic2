const cheerio = require('cheerio')
const fs = require('fs')

let platforms = fs.readFileSync(__dirname + '/Bus Network Regions.kml').toString()
let $ = cheerio.load(platforms)

let regionMaps = Array.from($('Placemark'))
let regions = regionMaps.map(region => {
  let regionName = $('name', region).text()

  let coordinatesRaw = $('coordinates', region).text().trim()
  let coordinates = coordinatesRaw.split('\n').filter(Boolean).map(line => {
    return line.trim().split(',').slice(0, 2).map(x => parseFloat(x))
  })

  return {
    properties: {
      name: regionName
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ coordinates ]
    }
  }
})

fs.writeFileSync(__dirname + '/regional-bus-network.json', JSON.stringify(regions, null, 1))
