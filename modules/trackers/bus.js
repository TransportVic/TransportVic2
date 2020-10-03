const config = require('../../config.json')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils')
const shuffle = require('lodash.shuffle')
const stops = require('../../additional-data/bus-tracker/stops')
const async = require('async')
const getDepartures = require('../../modules/bus/get-departures')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let refreshRate = 10

function isDay() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 270 <= minutes && minutes <= 1260 // 0500 - 2100
}

function isNight() {
  let minutes = utils.getMinutesPastMidnightNow()

  return 1261 <= minutes && minutes <= 1439 || minutes <= 60 // 2101 - 0100
}

/*
  Requests from:
  0500 - 2100: 160 req
  2100 - 0100: 24 req
*/
function updateRefreshRate() {
  if (isDay()) refreshRate = 7
  else if (isNight()) refreshRate = 10
  else {
    let minutes = utils.getMinutesPastMidnightNow()
    if (minutes < 300) minutes += 1440

    refreshRate = 1740 - minutes + 1
    console.log('Bus Tracker going to sleep for ' + refreshRate + ' minutes')
  }
}

function pickRandomStops() {
  let size = 26
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
    }, i * 15000)
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
