const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../../database/DatabaseConnection')
const BufferedLineReader = require('../divide-and-conquer/BufferedLineReader')
const config = require('../../config')
const loadStops = require('../utils/load-stops')
const gtfsUtils = require('../../gtfs-utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/stats')

let permittedStops = [
  "Gunning Station",
  "Harden Station",
  "Broadmeadows Station",
  "Albury Station",
  "Moss Vale Station",
  "Yass Junction Station",
  "Seymour Station",
  "Melbourne (Southern Cross) Station",
  "The Rock Station",
  "Henty Station",
  "Culcairn Station",
  "Wangaratta Station",
  "Benalla Station",
  "Junee Station",
  "Goulburn Station",
  "Campbelltown Station",
  "Central Station",
  "Cootamundra Station",
  "Wagga Wagga Station",
  "Strathfield Station"
]

let suburbs = {
  "Sydney Central": "Sydney, NSW",
  "Wagga Wagga": "Turvey Park, NSW",
  "Southern Cross": "Melbourne City"
}

let vicStops = ['Southern Cross', 'Broadmeadows', 'Seymour', 'Benalla', 'Wangaratta']

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')
  let stopsLineReader = new BufferedLineReader(path.join(__dirname, '../../gtfs/14/stops.txt'))
  await stopsLineReader.open()

  let stopsData = []

  while (stopsLineReader.available()) {
    let line = await stopsLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let rawStopName = line[2].replace('Platform Station', 'Station')
    if (rawStopName.includes('Yass Station')) rawStopName = rawStopName.replace('Yass', 'Yass Junction')
    let stopName = rawStopName.replace(/ Plat.+/, '').trim()

    if (permittedStops.includes(stopName) && rawStopName.includes('Platform')) {
      let originalName = rawStopName.replace('Station', 'Railway Station')
      let mergeName = stopName.replace('Station', 'Railway Station')
      let stopGTFSID = 'XPT' + line[0]

      if (mergeName === 'Melbourne (Southern Cross) Railway Station') mergeName = 'Southern Cross Railway Station'
      if (mergeName === 'Central Railway Station') mergeName = 'Sydney Central Railway Station'

      let fakeSuburb = mergeName.replace(' Railway Station', '')
      fakeSuburb = suburbs[fakeSuburb] || fakeSuburb + (vicStops.includes(fakeSuburb) ? '' : ', NSW')

      stopsData.push({
        originalName,
        fullStopName: mergeName,
        stopGTFSID,
        location: {
          type: 'Point',
          coordinates: [parseFloat(line[4]), parseFloat(line[3])]
        },
        stopNumber: null,
        mode: 'regional train',
        suburb: fakeSuburb
      })
    }
  }

  await loadStops(stops, stopsData, {})

  await updateStats('xpt-stations', stopsData.length)
  console.log('Completed loading in ' + stopsData.length + ' xpt stations')
  process.exit()
})
