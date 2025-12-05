import fs from 'fs/promises'
import config from '../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)

await database.connect()
const stops = database.getCollection('stops')

const metroStations = await stops.findDocuments({
  'bays.mode': 'metro train'
}).toArray()

const vlineStations = await stops.findDocuments({
  'bays.mode': 'regional train'
}).toArray()

const bigBusStops = await stops.findDocuments({
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

const metroContent = metroStations.sort((a, b) => a.cleanName.localeCompare(b.cleanName)).map(station => {
  return `<url><loc>https://transportvic.me/metro/timings/${station.cleanName.slice(0, -16)}</loc></url>`
}).join('\n')

const vlineContent = vlineStations.sort((a, b) => a.cleanName.localeCompare(b.cleanName)).map(station => {
  return `<url><loc>https://transportvic.me/vline/timings/${station.cleanName.slice(0, -16)}</loc></url>`
}).join('\n')

const busContent = bigBusStops.sort((a, b) => a.cleanName.localeCompare(b.cleanName)).map(station => {
  return `<url><loc>https://transportvic.me/bus/timings/${station.cleanSuburbs[0]}/${station.cleanName}</loc></url>`
}).join('\n')

const otherURLs = [
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

const otherData = otherURLs.map(url => {
  return `<url><loc>https://transportvic.me${url}</loc></url>`
}).join('\n')

const data = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${metroContent}
${vlineContent}
${busContent}
${otherData}
</urlset>`

await fs.writeFile(path.join(__dirname, '../application/static/app-content/sitemap.xml'), data)
process.exit()