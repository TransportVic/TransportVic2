const request = require('request-promise')
const ptvAPI = require('../ptv-api')
const async = require('async')
const moment = require('moment')
const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')
const handleMTMSuspensions = require('./disruption-management/handle-mtm-suspensions')
const replacedServices = require('./vline/coach-replacement-overrides')

let isOnline = true
var refreshRate = 10;
let currentDisruptions

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

async function processVLineCoachOverrides(db) {
  let liveTimetables = db.getCollection('live timetables')
  let timetables = db.getCollection('timetables')
  await liveTimetables.deleteDocuments({ type: 'vline coach replacement' })

  await async.forEach(replacedServices, async rule => {
    let fromDate = moment.tz(rule.from_date, 'Australia/Melbourne')
    let toDate = moment.tz(rule.to_date, 'Australia/Melbourne')
    let lines = rule.lines

    let days = utils.allDaysBetweenDates(fromDate, toDate)
    let dayToDateMapping = {}
    days.forEach(day => {
      let dayOfWeek = daysOfWeek[day.day()]
      if (!dayToDateMapping[dayOfWeek]) dayToDateMapping[dayOfWeek] = []
      dayToDateMapping[dayOfWeek].push(day.format('YYYYMMDD'))
    })
    let daysOfWeekAffected = Object.keys(dayToDateMapping)

    let trips = await timetables.findDocuments({
      operationDays: { $in: daysOfWeekAffected },
      routeName: { $in: lines }
    }).toArray()

    let mappedTrips = trips.map(trip => {
      let operationDays = trip.operationDays.map(day => dayToDateMapping[day])
        .reduce((acc, day) => acc.concat(day), []).filter(day => !!day)

      if (trip.origin === 'Southern Cross Railway Station') {
        trip.stopTimings[0].stopName = 'Southern Cross Coach Terminal/Spencer St'
        trip.stopTimings[0].stopGTFSID = 20836
        trip.origin = 'Southern Cross Coach Terminal/Spencer St'
      }
      if (trip.destination === 'Southern Cross Railway Station') {
        trip.stopTimings[trip.stopTimings.length - 1].stopName = 'Southern Cross Coach Terminal/Spencer St'
        trip.stopTimings[trip.stopTimings.length - 1].stopGTFSID = 20836
        trip.destination = 'Southern Cross Coach Terminal/Spencer St'
      }

      trip.operationDay = operationDays // use operationDays for live too?
      trip.type = 'vline coach replacement'
      trip.vehicle = 'Coach'
      trip.mode = 'regional coach'
      trip.routeName += ' Line'
      delete trip._id

      return trip
    })

    liveTimetables.bulkWrite(mappedTrips.map(trip => {
      if (!trip.departureTime) console.log(trip)
      return {
        insertOne: trip
      }
    }))
  })
}

database.connect((err) => {
  let liveTimetables = database.getCollection('live timetables')
  liveTimetables.createIndex({
    mode: 1,
    routeName: 1,
    operationDay: 1,
    origin: 1,
    destination: 1,
    departureTime: 1
  }, {unique: true})

  processVLineCoachOverrides(database)

  async function refreshCache() {
    try {
      const {status, disruptions} = await ptvAPI('/v3/disruptions')
      if (status.health === 0) throw new Error('')

      currentDisruptions = disruptions
      isOnline = true

      let mtmSuspensions = disruptions.metro_train.filter(disruption => disruption.disruption_type.toLowerCase().includes('suspended'))
      if (mtmSuspensions.length) handleMTMSuspensions(mtmSuspensions, database)
      else await liveTimetables.deleteDocuments({ type: "suspension" })
    } catch (e) {
      console.log('Failed to pass health check, running offline')
      console.err(e)
      isOnline = false
    }
  }

  setInterval(refreshCache, refreshRate * 60 * 1000);
  refreshCache();
})

module.exports = {
  isOnline: () => isOnline,
  getDisruptions: () => currentDisruptions
}
