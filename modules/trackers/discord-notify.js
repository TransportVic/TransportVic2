const discordIntegration = require('../discord-integration')
const schedule = require('./scheduler')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const VLineTracker = require('../../application/routes/tracker/VLineTracker')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let vlineTrips

async function findVLine(today, date) {
  let allTrips = (await vlineTrips.findDocuments({ date: today })
    .sort({destination: 1}).toArray())
    .filter(trip => !!trip.consist[0])
    .map(trip => {
      let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(trip.departureTime)
      if (departureTimeMinutes < 180) departureTimeMinutes += 1440

      trip.departureTimeMinutes = departureTimeMinutes
      trip.string = `#${trip.runID}: ${trip.departureTime} ${trip.origin} - ${trip.destination}: ${trip.consist.join('-')}`

      return trip
    })
    .sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes)

  let highlights = await VLineTracker.filterHighlights(utils.now(), allTrips, database)


  let data = ''

  if (highlights.doubleHeaders.length) {
    data += `Double Headers
${highlights.doubleHeaders.map(trip => trip.string).join('\n')}\n\n`
  }
  if (highlights.consistTypeChanged.length) {
    data += `Consist Type Changed
${highlights.consistTypeChanged.map(trip => trip.string).join('\n')}\n\n`
  }
  if (highlights.oversizeConsist.length) {
    data += `Oversize Consist
${highlights.oversizeConsist.map(trip => trip.string).join('\n')}\n\n`
  }
  if (highlights.setAltered.length) {
    data += `Set Altered
${highlights.setAltered.map(trip => trip.string).join('\n')}\n\n`
  }
  if (highlights.unknownVehicle.length) {
    data += `Unknown Vechicle
${highlights.unknownVehicle.map(trip => trip.string).join('\n')}\n\n`
  }
  if (highlights.unknownTrips.length) {
    data += `Unknown Trip
${highlights.unknownTrips.map(trip => trip.string).join('\n')}\n\n`
  }

  if (data.length) {
    await discordIntegration('vlineNotify', `V/Line Highlights on ${date}\n${data}`)
  } else {
    await discordIntegration('vlineNotify', `No V/Line Highlights on ${date}`)
  }
}

async function updateData() {
  let today = utils.getYYYYMMDDNow()
  let date = utils.now().format('dddd, MMMM Do YYYY')

  try { await findVLine(today, date) } catch (e) { await discordIntegration('vlineNotify', 'Failed to send V/Line Trips on ' + date) }
}

database.connect(async () => {
  vlineTrips = database.getCollection('vline trips')

  schedule([
    [240, 241, 15]
  ], updateData, 'discord notify', global.loggers.general)
})
