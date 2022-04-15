const discordIntegration = require('../discord-integration')
const schedule = require('./scheduler')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')
const VLineTracker = require('../../application/routes/tracker/VLineTracker')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let liveTimetables, vlineTrips

async function findHCMT(today, date) {
  let hcmtTrains = await liveTimetables.findDocuments({
    operationDays: today,
    mode: 'metro train',
    routeGTFSID: {
      $in: ['2-PKM', '2-CRB']
    },
    h: true
  }).sort({ 'stopTimings.0.departureTimeMinutes': 1 }).toArray()

  let shifts = {}
  let runIDShifts = {}

  hcmtTrains.forEach(trip => {
    if (!runIDShifts[trip.runID]) {
      shifts[trip.runID] = []
      runIDShifts[trip.runID] = trip.runID
    }

    let shiftNumber = runIDShifts[trip.runID]
    shifts[shiftNumber].push(trip.runID)

    if (trip.forming !== '0') runIDShifts[trip.forming] = shiftNumber
  })

  let shiftTrips = Object.values(shifts).map(shiftTrips => {
    return shiftTrips.map((runID, i) => {
      let trip = hcmtTrains.find(tripData => tripData.runID === runID)
      let data = `#${trip.runID}: ${trip.trueDepartureTime} ${trip.trueOrigin.slice(0, -16)} - ${trip.trueDestination.slice(0, -16)}`

      if (i === shiftTrips.length - 1) {
        return `${data}
OFF${trip.forming ? `: ${trip.forming} ETY CARS` : ''}`
      } else {
        return data
      }
    }).join('\n')
  })

  let shiftData = `HCMT Trips on ${date}
${shiftTrips.join('\n\n')}`

  if (hcmtTrains.length) {
    await discordIntegration('hcmtNotify', shiftData)
  } else {
    await discordIntegration('hcmtNotify', `No HCMT Trips detected on ${date}`)
  }
}

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

  try { await findHCMT(today, date) } catch (e) { await discordIntegration('hcmtNotify', 'Failed to send HCMT Trips on ' + date) }
  // try { await findVLine(today, date) } catch (e) { await discordIntegration('vlineNotify', 'Failed to send V/Line Trips on ' + date) }
}

database.connect(async () => {
  liveTimetables = database.getCollection('live timetables')
  vlineTrips = database.getCollection('vline trips')

  schedule([
    [240, 241, 15]
  ], updateData, 'discord notify', global.loggers.general)
})
