const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/bus/get-departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

async function getData(req, res) {
  let stops = res.db.getCollection('stops')
  let bay = rq.params.bay.toUpperCase()

  let stop = await stops.findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'bus')) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stopName + '. Are you sure buses stop there?')
  }


  let departures = (await getDepartures(stop, res.db))
    .filter(departure => {
      let diff = departure.actualDepartureTime
      let minutesDifference = diff.diff(utils.now(), 'minutes')

      if (departure.bay) {
        let bayID = departure.bay.slice(4)
        return bayID === bay
      } else return false

      return -1 <= minutesDifference && minutesDifference < 120
    })

  return {departures, stop}
}

router.get('/:suburb/:stopName/:bay', async (req, res) => {
  // let {departures, stop} = await getData(req, res)

  // res.json({departures, stop})
  res.render('mockups/bus-int/pids')
  // res.render('mockups/bus-int/pids', { departures, stop })
})

router.post('/:suburb/:stopName/:bay', async (req, res) => {
  let {departures, stop} = await getData(req, res)

  res.json({departures, stop})
})

module.exports = router



/*
WIDTH
whole screen is 1876px
timings bit is 1426px 75%

info bit is 366px 20%
mid spacing 40px 2%
edge spacing 15px 1.5%
call 325px 17%

HEIGHT
overall 520px
each line 63px, border 2px bottom total 65px 12.5%
dest/departing 43px 8%
plat 24px 5%
heading 34px 6%
scheduled 38px 7%
time 80px 15%
call 25px 5%

infobox 288px 55%
timebox 100px 20%
bottom 10px 2%
spacing 104px 20%

network sans: 35px
*/
