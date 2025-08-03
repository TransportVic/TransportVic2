import utils from '../utils.js'
import ptvAPI from '../ptv-api.js'
import { writeFile } from 'fs/promises'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let key = await ptvAPI.getPTVKey(undefined, 12000)
let data = JSON.parse(await utils.request('https://www.ptv.vic.gov.au/lithe/stored-stops-all?__tok=' + key, {
  timeout: 12000
}))

let tramStops = data.stops.filter(stop => {
  if (stop.primaryChronosMode === 1) return true
  if (stop.primaryChronosMode === 2) { // Bus using tram stop
    return stop.title.includes('#') || stop.title.match(/^(D?\d+[a-zA-Z]?)-/)
  }

  return false
}).map(stop => {
  let stopNumberParts = stop.title.match(/^(D?\d+[a-zA-Z]?)-/)
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

let busStops = data.stops.reduce((acc, stop) => {
  let stopName = stop.title.trim()
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
await writeFile(path.join(__dirname, 'ptv-stops.json'), JSON.stringify(busStops))

process.exit()
