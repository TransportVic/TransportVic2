const request = require('request-promise')
const async = require('async')
const cheerio = require('cheerio')

const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('../utils/gtfs-stats')

let start = new Date()

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('stops')
  let body = await request({
    method: 'GET',
    uri: 'https://maps.busminder.com.au/route/live/79290903-fd57-48ac-be22-990857625ecc',
    gzip: true,
    headers: {
      'Origin': 'https://maps.busminder.com.au',
      'User-Agent': 'Mozilla/5.0 (Macintosh, Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15',
      'Referer': 'https://maps.busminder.com.au/',
      'Host': 'maps.busminder.com.au'
    }
  })
  const $ = cheerio.load(body)
  let data = $('body > script:nth-child(10)').html()
  data = data.trim().slice(26).replace(/\n/g, '').replace(/;var .+$/, '').slice(0, -2)
  let parsedData = JSON.parse(data)

  let stopMapping = {}

  parsedData.routes.filter(route => route.stops.length).forEach(route => {
    route.stops.forEach(stop => {
      let {name} = stop
      let stopNameParts = name.match(/(\d+): Stop ([\w]+)/)
      if (!stopNameParts) return
      let [_, stopGTFSID, stopNumber] = stopNameParts
      if (stopGTFSID === '13233') stopGTFSID = '21214'

      stopMapping[stopGTFSID] = stopNumber
    })
  })

  await async.forEach(Object.keys(stopMapping), async stopGTFSID => {
    let stopNumber = stopMapping[stopGTFSID]
    stopGTFSID = parseInt(stopGTFSID)
    let query = {'bays.stopGTFSID': stopGTFSID}

    let dbStop = await stops.findDocument(query)
    if (!dbStop) console.log(query)
    dbStop.bays = dbStop.bays.map(bay => {
      if (bay.stopGTFSID === stopGTFSID) {
        bay.stopNumber = stopNumber
      }
      return bay
    })
    await stops.replaceDocument(query, dbStop)
  })

  let stopCount = Object.keys(stopMapping).length

  await updateStats('788-stop-numbers', stopCount, new Date() - start)
  console.log('Completed updating ' + stopCount + ' bus stop numbers for 788')
  process.exit()
})
