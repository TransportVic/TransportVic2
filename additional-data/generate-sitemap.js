const cheerio = require('cheerio')
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
        /Shopping Centre/,
        /Railway Station/,
        /Interchange/
      ]
    }
  }).toArray()

  let metroContent = metroStations.map(station => {
    return `<url><loc>https://vic.transportsg.me/metro/timings/${station.codedName.slice(0, -16)}</loc></url>`
  }).join('')

  let vlineContent = vlineStations.map(station => {
    return `<url><loc>https://vic.transportsg.me/vline/timings/${station.codedName.slice(0, -16)}</loc></url>`
  }).join('')

  let busContent = bigBusStops.map(station => {
    return `<url><loc>https://vic.transportsg.me/bus/timings/${station.codedSuburb[0]}/${station.codedName}</loc></url>`
  }).join('')

  let otherURLs = [
    '/',
    '/bookmarks',
    '/bus/tracker',
    '/tram/tracker',
    '/mockups',
    '/search',
    '/nearby',
    '/railmap',
    '/about'
  ]

  let otherData = otherURLs.map(url => {
    return `<url><loc>https://vic.transportsg.me${url}</loc></url>`
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
