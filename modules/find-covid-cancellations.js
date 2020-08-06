const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')
const async = require('async')
const ptvAPI = require('../ptv-api')
const moment = require('moment')
require('moment-timezone')

const getStoppingPattern = require('./utils/get-stopping-pattern')

let covid19Cancelled, stops

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let checkStops = [
  'Box Hill',
  'Ringwood East',
  'Ferntree Gully',
  'Lilydale',
  'Burwood',
  'Mount Waverley',
  'Heyington',
  'Camberwell',
  'Cranbourne',
  'Clifton Hill',
  'Mernda',
  'Hurstbridge',
  'Greensborough',
  'Eltham',
  'South Yarra',
  'North Melbourne',
  'North Williamstown',
  'Laverton',
  'Flinders Street',
  'Dandenong'
]

async function sleep(time) {
  return await new Promise(resolve => setTimeout(resolve, time))
}

async function run() {
  let departureMoment = utils.now().startOf('day').add(19, 'hours')
  let departureTime = departureMoment.toISOString()
  let day = departureMoment.format('YYYYMMDD')

  let cancelledTrips = []
  let runIDs = []

  await async.forEachSeries(checkStops, async stopName => {
    let stopData = await stops.findDocument({ stopName: stopName + ' Railway Station' })
    let bay = stopData.bays.find(bay => bay.mode === 'metro train')

    let data = await ptvAPI(`/v3/departures/route_type/0/stop/${bay.stopGTFSID}?gtfs=true&date_utc=${departureTime}&max_results=50&include_cancelled=true&expand=run`)
    let { runs } = data
    let cancelled = Object.values(runs).filter(run => run.status === 'cancelled' && run.vehicle_descriptor).map(run => run.vehicle_descriptor.id)
    cancelled.forEach(trip => {
      if (runIDs.includes(trip)) return
      runIDs.push(trip)
      cancelledTrips.push({ day, runID: trip })
    })

    await sleep(1000)
  })

  await async.forEachSeries(cancelledTrips, async trip => {
    let ptvRunID
    if (trip.runID.match(/[RX]/)) ptvRunID = 988000 + parseInt(trip.runID.slice(1))
    else ptvRunID = 948000 + parseInt(trip.runID)

    let tripData = await getStoppingPattern(database, ptvRunID, 'metro train', departureTime)

    await covid19Cancelled.replaceDocument(trip, {
      ...trip,
      origin: tripData.trueOrigin,
      destination: tripData.trueDestination,
      departureTime: tripData.trueDepartureTime
    }, {
      upsert: true
    })

    await sleep(1500)
  })

}

database.connect({}, async () => {
  stops = database.getCollection('stops')
  covid19Cancelled = database.getCollection('covid19 cancellations')

  await covid19Cancelled.createIndex({
    day: 1,
    runID: 1
  }, {name: 'COVID-19 Cancellations index'})

  let runTime = utils.now().startOf('day').add(11, 'hours')
  let now = utils.now()

  let diff = runTime - now
  if (diff < 0) diff += 1440 * 60 * 1000

  setTimeout(() => {
    run()
    setInterval(run, 1440 * 60 * 1000)
  }, diff)
})
