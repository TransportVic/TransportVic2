import utils from '../utils.mjs'
import { getPTVKey } from '../ptv-api.mjs'
import { writeFile } from 'fs/promises'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const data = JSON.parse(await utils.request('https://www.ptv.vic.gov.au/lithe/stored-stops-all', {
  headers: {
    'content-type': 'application/json',
    'origin': 'https://transport.vic.gov.au/',
    'referer': 'https://transport.vic.gov.au/',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'x-ptv-token': getPTVKey()
  },
  timeout: 12000
}))

const stops = data.stops.map(stop => ({
  ...stop,
  title: stop.title || stop.stop_landmark
})).filter(stop => stop.title || void console.log('Bad stop', stop))

const tramStops = stops.filter(stop => {
  if (stop.primaryChronosMode === 1) return true
  if (stop.primaryChronosMode === 2) { // Bus using tram stop
    return stop.title.includes('#') || stop.title.match(/^(D?\d+[a-zA-Z]?)-/)
  }

  return false
}).map(stop => {
  const stopNumberParts = stop.title.match(/^(D?\d+[a-zA-Z]?)-/)
  let [stopName, stopNumber] = stop.title.trim().split(' #')

  if (stopNumberParts) {
    stopNumber = stopNumberParts[1]
    stopName = stopName.replace(stopNumberParts[0], '')
  }

  return {
    stopName: stopName.replace(/\/\d+ /, '/') + ' #' + stopNumber,
    stopNumber,
    stopID: stop.id
  }
})

const allStops = stops.reduce((acc, stop) => {
  const stopName = stop.title.trim()
  if (!acc[stopName]) acc[stopName] = []
  acc[stopName].push({
    location: {
      type: 'Point',
      coordinates: [
        stop.location.lon, stop.location.lat
      ]
    },
    suburb: stop.suburb
  })
  return acc
}, {})

await writeFile(path.join(__dirname, 'tram', 'tram-stops.json'), JSON.stringify(tramStops))
await writeFile(path.join(__dirname, 'ptv-stops.json'), JSON.stringify(allStops))

process.exit()
