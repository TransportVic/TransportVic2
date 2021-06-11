const discordIntegration = require('../discord-integration')
const schedule = require('./scheduler')
const config = require('../../config')
const utils = require('../../utils')
const DatabaseConnection = require('../../database/DatabaseConnection')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let liveTimetables

async function findHCMT(today) {
  let hcmtTrains = await liveTimetables.findDocuments({
    operationDays: today,
    mode: 'metro train',
    routeGTFSID: '2-PKM',
    h: true
  }).sort({ departureTime: 1 }).toArray()

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

  let shiftData = `HCMT Trips on ${utils.now().format('dddd, MMMM Do YYYY')}
${shiftTrips.join('\n\n')}`

  await discordIntegration('hcmtNotify', shiftData)
}

async function updateData() {
  let today = utils.getYYYYMMDDNow()
  await findHCMT(today)
}

database.connect(async () => {
  liveTimetables = database.getCollection('live timetables')

  schedule([
    [240, 241, 15]
  ], updateData, 'discord notify', global.loggers.general)
})
