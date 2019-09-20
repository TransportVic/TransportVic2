const express = require('express')
const router = new express.Router()
const moment = require('moment')
const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

router.get('/:stationName', async (req, res) => {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stationName
  })

  if (!station) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stationName + '. Are you sure Metro trains stop there?')
  }

  const now = moment().tz('Australia/Melbourne')
  const startOfToday = now.clone().startOf('day')
  const minutesPastMidnight = now.diff(startOfToday, 'minutes')
  const today = daysOfWeek[now.day()]

  let metroPlatform = station.bays.filter(bay => bay.mode === 'metro train')[0]

  const timetables = res.db.getCollection('timetables')
  const trips = await timetables.findDocuments({
    stopTimings: {
      $elemMatch: {
        stopGTFSID: metroPlatform.stopGTFSID,
        departureTimeMinutes: {
          $gt: minutesPastMidnight,
          $lte: minutesPastMidnight + 30
        }
      }
    },
    operationDays: today,
    mode: "metro train"
  }).toArray()

  res.json(trips)
})

module.exports = router
