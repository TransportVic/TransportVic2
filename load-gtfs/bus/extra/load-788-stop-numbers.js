const async = require('async')
const cheerio = require('cheerio')

const DatabaseConnection = require('../../../database/DatabaseConnection')
const config = require('../../../config')
const utils = require('../../../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../../utils/stats')

const polyline = require('@mapbox/polyline')
const { closest } = require('fastest-levenshtein')

async function findCloseStops(stops, stopData, distance) {
  let ids = []

  return (await async.mapSeries(stopData.location, async location => {
    let found = await stops.findDocuments({
      _id: {
        $not: {
          $in: ids
        }
      },
      location: {
        $nearSphere: {
          $geometry: {
            type: 'MultiPoint',
            coordinates: location
          },
          $maxDistance: distance
        }
      }
    }).toArray()
    ids.push(...found.map(stop => stop._id))

    return found
  })).reduce((a, e) => a.concat(e), [])
}

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')
  let gtfsTimetables = database.getCollection('gtfs timetables')

  let body = await utils.request('https://maps.busminder.com.au/route/live/79290903-fd57-48ac-be22-990857625ecc', {
    headers: {
      'Origin': 'https://maps.busminder.com.au',
      'User-Agent': 'Mozilla/5.0 (Macintosh, Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15',
      'Referer': 'https://maps.busminder.com.au/',
      'Host': 'maps.busminder.com.au'
    },
    timeout: 12000
  })

  let $ = cheerio.load(body)
  let scripts = Array.from($('body > script')).map(script => {
    return $(script).html()
  })

  let data = scripts.sort((a, b) => b.length - a.length)[0].trim()
  let lines = data.split('\n').map(line => line.trim()).sort((a, b) => b.length - a.length)

  let longestLine = lines[0]
  let jsonData = longestLine.slice(longestLine.indexOf('{')).replace(/\n/g, '').slice(0, -2)

  let parsedData = JSON.parse(jsonData)

  let stopMappings = {}

  parsedData.routes.filter(route => route.stops.length).forEach(route => {
    route.stops.forEach(stop => {
      let { name, position } = stop
      let stopNameParts = name.match(/Stop (\d+[A-Z]?) ?-? ?(.*)/)
      if (!stopNameParts) return console.log(`No stop number for ${name}`)
      let [_, stopNumber, stopName ] = stopNameParts

      if (stopNumber === '20A') return

      if (!stopMappings[stopName]) {
        stopMappings[stopName] = {
          stopName,
          stopNumber,
          location: [polyline.decode(position)[0].reverse()]
        }
      } else {
        stopMappings[stopName].location.push(polyline.decode(position)[0].reverse())
      }
    })
  })

  stopMappings['Robertson Dr/Nepean Hwy (Mornington)'] = {
    stopName: 'Robertson Dr/Nepean Hwy (Mornington)',
    stopNumber: '112',
    location: [[ 145.052698159639, -38.2237081718997 ]]
  }

  stopMappings['Carrigg St/Pt Nepean Rd (Safety Beach)'] = {
    stopName: 'Carrigg St/Pt Nepean Rd (Safety Beach)',
    stopNumber: '89',
    location: [[ 144.969231,-38.330650 ]]
  }

  stopMappings['Mount Martha Rd/Bruce Rd (Mount Martha)'] = {
    stopName: 'Mount Martha Rd/Bruce Rd (Mount Martha)',
    stopNumber: '99',
    location: [[144.997589080603, -38.3046023590664 ]]
  }

  stopMappings['Ross Smith Ave/Nepean Hwy (Frankston)'] = {
    stopName: 'Ross Smith Ave/Nepean Hwy (Frankston)',
    stopNumber: '124',
    location: [[145.12147, -38.14165 ]]
  }

  await async.forEachSeries(Object.keys(stopMappings), async stopName => {
    let stopData = stopMappings[stopName]
    let possibleStops = await findCloseStops(stops, stopData, 50)
    if (!possibleStops.length) possibleStops = await findCloseStops(stops, stopData, 100)
    if (!possibleStops.length) possibleStops = await findCloseStops(stops, stopData, 200)

    if (!possibleStops.length) return console.log(`Failed to map ${stopName} Stop #${stopData.stopNumber}`)

    let stop
    if (possibleStops.length > 1) {
      let stopsWith788 = await async.filter(possibleStops, async stop => {
        let stopGTFSIDs = stop.bays.map(bay => bay.stopGTFSID)
        let timetable = await gtfsTimetables.findDocument({
          mode: 'bus',
          routeNumber: '788',
          'stopTimings.stopGTFSID': {
            $in: stopGTFSIDs
          }
        })

        return !!timetable
      })

      let possibleStopNames = stopsWith788.map(stop => stop.bays).reduce((a, e) => a.concat(e), []).map(bay => bay.originalName).filter((e, i, a) => a.indexOf(e) === i)
      let bestMatch = closest(stopName, possibleStopNames)
      stop = stopsWith788.find(stop => stop.bays.some(bay => bay.originalName === bestMatch))
    } else stop = possibleStops[0]

    await async.forEach(stop.bays, async bay => {
      let timetable = await gtfsTimetables.findDocument({
        mode: 'bus',
        routeNumber: '788',
        'stopTimings.stopGTFSID': bay.stopGTFSID
      })

      if (timetable) bay.stopNumber = stopData.stopNumber
      if (bay.stopGTFSID == 13624) bay.stopNumber = '64A'
      if (bay.stopGTFSID == 13179) bay.stopNumber = '83'
      if (bay.stopGTFSID == 13197) bay.stopNumber = '101'
      if (bay.stopGTFSID == 11258) bay.stopNumber = '123'
      if (bay.stopGTFSID == 12592) bay.stopNumber = '112A'
    })

    await stops.replaceDocument({
      _id: stop._id
    }, stop)
  })

  let stopCount = Object.keys(stopMappings).length

  await updateStats('788-stop-numbers', stopCount)
  console.log('Completed updating ' + stopCount + ' bus stop numbers for 788')
  process.exit()
})
