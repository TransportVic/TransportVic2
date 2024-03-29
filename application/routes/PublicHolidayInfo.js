const express = require('express')
const utils = require('../../utils')
const config = require('../../config')
const fs = require('fs')
const path = require('path')
const async = require('async')
const { getPHDayOfWeek, getPublicHolidayName, isNightNetworkRunning } = require('../../public-holidays')
const router = new express.Router()

router.use('/:rawDays', async (req, res) => {
  let days = req.params.rawDays.split('-').slice(0, 7)
  let gtfsTimetables = res.db.getCollection('gtfs timetables')

  let data = (await async.map(days, async day => {
    let dayMoment = utils.parseDate(day)

    let actualDay = utils.getDayOfWeek(dayMoment)
    let phDay = await getPHDayOfWeek(dayMoment)
    let phName = getPublicHolidayName(dayMoment)

    let cityCircleRunning = !!await gtfsTimetables.findDocument({
      operationDays: day,
      mode: 'tram',
      routeGTFSID: '3-35'
    })

    let nightNetworkRunning = null
    if (utils.isNightNetworkDay(actualDay)) {
      nightNetworkRunning = await isNightNetworkRunning(dayMoment)
    }

    return {
      name: phName,
      scheduleDay: phDay,
      day: dayMoment,
      nightNetworkRunning,
      cityCircleRunning
    }
  })).filter(ph => ph.name)

  res.render('public-holiday', { holidays: data })
})

module.exports = router
