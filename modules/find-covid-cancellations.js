const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')
const async = require('async')
const ptvAPI = require('../ptv-api')
const moment = require('moment')
require('moment-timezone')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let checkStops = [
  'Box Hill',
  'Ringwood East',
  'Ferntree Gully',
  'Lilydale',
  'Alamein',
  'Darling',
  'Camberwell',
  'Cranbourne',
  'Clifton Hill',
  'South Yarra',
  'North Melbourne',
  'North Williamstown',
  'Laverton',
  'Flinders Street',
  'Dandenong'
]

async function run() {
  let departureMoment = moment.tz('Australia/Melbourne').startOf('day').add(19, 'hours')
  let departureTime = departureMoment.toISOString()
  let day = departureMoment.format('YYYYMMDD')

  let stops = database.getCollection('stops')
  let covid19Cancelled = database.getCollection('covid19 cancellations')

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
  })

  await async.forEach(cancelledTrips, async trip => {
    await covid19Cancelled.replaceDocument(trip, trip, {
      upsert: true
    })
  })
}

database.connect({}, async () => {
  let runTime = moment.tz('Australia/Melbourne').startOf('day').add(5, 'hours')
  let now = moment.tz('Australia/Melbourne')

  let diff = runTime - now
  if (diff < 0) diff += 1440 * 60 * 1000

  setTimeout(() => {
    run()
    setInterval(run, 1440 * 60 * 1000)
  }, diff)
})
