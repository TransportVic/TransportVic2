const fs = require('fs')
const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

database.connect(async () => {
  let stops = database.getCollection('stops')

  let metroStations = await stops.findDocuments({
    'bays.mode': 'metro train'
  }).toArray()

  let vlineStations = await stops.findDocuments({
    'bays.mode': 'regional train'
  }).toArray()

  let bigBusStops = await stops.findDocuments({
    'bays.mode': 'bus',
    stopName: {
      $in: [
        /Shops/,
        /Shopping Centre/,
        /Railway Station/,
        /Interchange/
      ]
    }
  }).toArray()

  let metroContent = metroStations.sort((a, b) => a.codedName.localeCompare(b.codedName)).map(station => {
    return `<url><loc>https://transportvic.me/metro/timings/${station.codedName.slice(0, -16)}</loc></url>`
  }).join('')

  let vlineContent = vlineStations.sort((a, b) => a.codedName.localeCompare(b.codedName)).map(station => {
    return `<url><loc>https://transportvic.me/vline/timings/${station.codedName.slice(0, -16)}</loc></url>`
  }).join('')

  let busContent = bigBusStops.sort((a, b) => a.codedName.localeCompare(b.codedName)).map(station => {
    return `<url><loc>https://transportvic.me/bus/timings/${station.codedSuburb[0]}/${station.codedName}</loc></url>`
  }).join('')

  let otherURLs = [
    '/',
    '/bookmarks',
    '/bus/tracker',
    '/tram/tracker',
    '/metro/tracker',
    '/vline/tracker',
    '/mockups',
    '/search',
    '/nearby',
    '/railmap',
    '/about'
  ]

  let otherData = otherURLs.map(url => {
    return `<url><loc>https://transportvic.me${url}</loc></url>`
  }).join('')

  let data = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${metroContent}
${vlineContent}
${busContent}
${otherData}
</urlset>`

  fs.writeFileSync(__dirname + '/../application/static/app-content/sitemap.xml', data)

  process.exit()
})
