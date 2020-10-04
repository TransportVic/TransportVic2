const config = require('../../config.json')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils')
const shuffle = require('lodash.shuffle')
const stops = require('../../additional-data/tram-tracker/stops')
const async = require('async')
const getDepartures = require('../../modules/tram/get-departures-experimental')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let refreshRate = 6

function isDay() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 270 <= minutes && minutes <= 1200 // 0500 - 2000
}

function isNight() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 1201 <= minutes && minutes <= 1439 || minutes <= 120 // 2101 - 0200
}

/*
  Requests from:
  0500 - 2000: 150 req
  2000 - 0200: 36 req
*/
function updateRefreshRate() {
  if (isDay()) refreshRate = 6
  else if (isNight()) refreshRate = 10
  else {
    let minutes = utils.getMinutesPastMidnightNow()
    if (minutes < 300) minutes += 1440

    refreshRate = 1740 - minutes + 1
    console.log('Tram Tracker going to sleep for ' + refreshRate + ' minutes')
  }
}

function pickRandomStops() {
  let size = 20
  if (isNight()) size = Math.floor(size / 2)
  return shuffle(stops).slice(0, size)
}

async function requestTimings() {
  let stops = pickRandomStops()
  await async.forEachOf(stops, async (stop, i) => {
    console.log('requesting timings for', stop)
    let [codedSuburb, codedName] = stop.split('/')
    let dbStop = await dbStops.findDocument({ codedName, codedSuburb })
    if (!dbStop) return console.log('could not find', stop)

    setTimeout(async () => {
      await getDepartures(dbStop, database)
    }, i * 20000)
  })

  updateRefreshRate()
  setTimeout(requestTimings, refreshRate * 60 * 1000)
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  if (!isNight() && !isDay()) {
    updateRefreshRate()
    setTimeout(requestTimings, refreshRate * 60 * 1000)
  } else {
    await requestTimings()
  }
})
