const express = require('express')
const utils = require('../../utils')
const config = require('../../config')
const fs = require('fs')
const path = require('path')
const async = require('async')
const { getPHDayOfWeek, getPublicHolidayName } = require('../../public-holidays')
const router = new express.Router()

router.use('/:rawDays', async (req, res) => {
  let days = req.params.rawDays.split('-').slice(0, 7)

  let data = (await async.map(days, async day => {
    let dayMoment = utils.parseDate(day)

    let phDay = await getPHDayOfWeek(dayMoment)
    let phName = getPublicHolidayName(dayMoment)

    return {
      name: phName,
      scheduleDay: phDay,
      fallsOnWeekday: utils.isWeekday(phDay),
      day: dayMoment
    }
  })).filter(ph => ph.name)

  res.render('public-holiday', { holidays: data })
})

module.exports = router
