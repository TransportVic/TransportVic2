const express = require('express')
const router = new express.Router()
const getBusDepartures = require('../../../modules/bus/get-departures')
const getTrainDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const async = require('async')
const utils = require('../../../utils')

async function getData(req, res) {
  let stops = res.db.getCollection('stops')
  let bay = req.params.bay.toUpperCase()

  let stop = await stops.findDocument({
    codedName: req.params.stopName,
    codedSuburb: req.params.suburb
  })

  if (!stop || !stop.bays.filter(bay => bay.mode === 'bus')) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + req.params.stopName + '. Are you sure buses stop there?')
  }

  let trainDepartures

  if (stop.bays.find(bay => bay.mode === 'metro train')) {
    let directionsSeen = []
    trainDepartures = (await getTrainDepartures(stop, res.db))
      .filter(departure => {
        let {direction} = departure.trip

        if (!directionsSeen.includes(direction)) {
          directionsSeen.push(direction)
          return true
        }
        return false
      }).sort(a => a.direction === 'Up' ? -1 : 1)
  }

  let directionCount = {}
  let busDepartures = (await getBusDepartures(stop, res.db))
    .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
    .filter(departure => {
      if (departure.bay) {
        let bayID = departure.bay.slice(4)
        if (bayID !== bay) return false
      } else return false

      let scheduled = departure.scheduledDepartureTime
      let {routeGTFSID, gtfsDirection} = departure.trip
      let id = routeGTFSID + '.' + gtfsDirection

      if (!directionCount[id]) directionCount[id] = 1
      else directionCount[id]++

      let minutesDifference = scheduled.diff(utils.now(), 'minutes')

      return directionCount[id] <= 2 && -1 <= minutesDifference && minutesDifference < 120
    })

  return {trainDepartures, busDepartures, stop}
}

router.get('/:suburb/:stopName/:bay', async (req, res) => {
  let data = await getData(req, res)

  let time = utils.now()

  res.render('mockups/bus-int-pids/pids', {
    time,
    ...data
  })
})

router.post('/:suburb/:stopName/:bay', async (req, res) => {
  let data = await getData(req, res)

  res.json({busDepartures, stop})
})

module.exports = router



/*
WIDTH
whole screen is 1876px
timings bit is 1426px 75%

HEADER WIDTHS:
ROUTE: width 124px 7%, margin left 16px 0.8%
DESTINATION: width 818px 44%, margin left 32px 1.7%
SCHEDULED: width 209px 11%
DPEARTING: width 194px 10%  margin left 38px 2%


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
