const request = require('request-promise')
const ptvAPI = require('../ptv-api')
const async = require('async')
const moment = require('moment')
const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')
const urls = require('../urls.json')
const handleMTMSuspensions = require('./disruption-management/handle-mtm-suspensions')
const replacedServices = require('./vline/coach-replacement-overrides')
const RSSParser = require('rss-parser')
let rssParser = new RSSParser()

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

async function watchPTVDisruptions(db) {
  let liveTimetables = db.getCollection('live timetables')
  let {status, disruptions} = await ptvAPI('/v3/disruptions')
  if (status.health === 0) throw new Error('PTV down')

  currentDisruptions = disruptions
  isOnline = true

  let mtmSuspensions = disruptions.metro_train.filter(disruption => disruption.disruption_type.toLowerCase().includes('suspended'))
  if (mtmSuspensions.length) handleMTMSuspensions(mtmSuspensions, db)
  else await liveTimetables.deleteDocuments({ type: "suspension" })
}

async function setServiceAsCancelled(db, query, operationDay, isCoach) {
  let liveTimetables = database.getCollection('live timetables')
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let timetables = database.getCollection('timetables')

  let timetable = await gtfsTimetables.findDocument(query)
    || await liveTimetables.findDocument(query) || await liveTimetables.findDocument(query)
  if (timetable) {
    timetable.operationDay = operationDay
    delete timetable.operationDays
    delete timetable._id
    timetable.type = 'cancelled'
    if (isCoach) {
      timetable.mode = 'regional coach'
      query.mode = 'regional coach'
      timetable.type = 'vline coach replacement'
    }

    await liveTimetables.replaceDocument(query, timetable, {
      upsert: true
    })
  }
}

async function watchVLineDisruptions(db) {
  let data = await utils.request(urls.vlineDisruptions)
  let feed = await rssParser.parseString(data)
  let items = feed.items.filter(item => item.title !== '')
  await async.forEach(items, async item => {
    let text = item.contentSnippet
    if (text.includes('will not run') || text.includes('has been cancelled')) {
      let service = text.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (:?to|-) ([\w ]*?) service (:?will not run|has been cancelled) /)
      let departureTime, origin, destination, isCoach
      let matches = []

      if (!service) {
        if (text.match(/services (:?will not run|has been cancelled)/)) {
          let services = text.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (:?to|-) ([\w ]*?) /g)
          services.forEach(service => {
            let parts = service.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (:?to|-) ([\w ]*?) /)
            departureTime = parts[1]
            origin = parts[2] + ' Railway Station'
            destination = parts[4] + ' Railway Station'
            isCoach = text.includes('coaches') && text.includes('replace')
            matches.push({departureTime, origin, destination, isCoach})
          })
        }
      } else {
        departureTime = service[1]
        origin = service[2] + ' Railway Station'
        destination = service[4] + ' Railway Station'
        isCoach = text.includes('replacement coaches')
        matches.push({departureTime, origin, destination, isCoach})
      }

      let operationDay = utils.getYYYYMMDDNow()

      await async.forEach(matches, async match => {
        let {departureTime, origin, destination, isCoach} = match

        let query = {
          departureTime, origin, destination,
          mode: 'regional train',
          $or: [{
            operationDay
          }, {
            operationDays: operationDay
          }]
        }

        await setServiceAsCancelled(db, query, operationDay, isCoach)
      })
    }
  })
}

// during peak an increased update freq of 10min is used - 24req during both peaks combined
// 4 hours peak time
function isPeak() {
  let minutes = utils.getMinutesPastMidnightNow()

  let isAMPeak = 360 <= minutes && minutes <= 510 // 0630 - 0830
  let isPMPeak = 1020 <= minutes && minutes <= 1140 // 1700 - 1900

  return isAMPeak || isPMPeak
}

// during night a reduced frequency of 20min is used - 24req during night time
// 8 hours night time
function isNight() {
  let minutes = utils.getMinutesPastMidnightNow()

  let isPast2130 = minutes > 1290 // past 2130
  let isBefore0530 = minutes < 330 // before 0530

  return isPast2130 || isBefore0530
}

// 4hr peak -> 24req
// 8hr night-> 24req
// 12hr left-> 48req
// total      96req per endpoint not account restarts
function updateRefreshRate() {
  if (isNight()) refreshRate = 20
  else if (isPeak()) refreshRate = 10
  else refreshRate = 15
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

  let functions = [watchPTVDisruptions, watchVLineDisruptions]

  async function refreshCache() {
    try {
      await async.forEach(functions, async fn => {
        // await fn(database)
      })
    } catch (e) {
      console.log('Failed to pass health check, running offline')
      console.err(e)
      isOnline = false
    } finally {
      updateRefreshRate()
      setTimeout(refreshCache, refreshRate * 60 * 1000)
    }
  }

  refreshCache()
})

module.exports = {
  isOnline: () => isOnline,
  getDisruptions: () => currentDisruptions
}
