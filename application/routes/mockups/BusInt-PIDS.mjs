import express from 'express'
import getBusDepartures from '../../../modules/bus/get-departures.mjs'
import getTrainDepartures from '../../../modules/metro-trains/get-departures.mjs'
import busDestinations from '../../../additional-data/bus-destinations.json' with { type: 'json' }
import utils from '../../../utils.mjs'

const router = new express.Router()

async function getData(req, res, full) {
  let stops = res.db.getCollection('stops')
  let bay = req.params.bay.toUpperCase()

  let stop = await stops.findDocument({
    cleanName: req.params.stopName,
    cleanSuburbs: req.params.suburb
  })

  if (!stop || !stop.bays.some(bay => bay.mode === 'bus')) {
    // TODO: create error page
    return { trainDepartures: null, busDepartures: null, error: true }
  }

  let trainDepartures

  if (stop.bays.some(bay => bay.mode === 'metro train')) {
    trainDepartures = (await getTrainDepartures(stop, res.db))
      .filter(departure => !departure.isRailReplacementBus && !departure.cancelled)

    let downTrips = []
    let upTrips = []

    trainDepartures.forEach(departure => {
      let {direction} = departure.trip

      if (direction === 'Up') upTrips.push(departure)
      else downTrips.push(departure)
    })

    let directionSize = full ? 2 : 1

    let upLength = Math.min(directionSize, upTrips.length)
    let downLength = Math.min(directionSize, downTrips.length)

    if (downLength !== directionSize) upLength = Math.min(2 * directionSize - downLength, upTrips.length)

    trainDepartures = [
      ...upTrips.slice(0, upLength),
      ...downTrips.slice(0, downLength)
    ]
  }

  let directionCount = {}
  let busDepartures = (await getBusDepartures(stop, res.db, res.tripDB))
    .sort((a, b) => a.actualDepartureTime - b.actualDepartureTime)
    .filter(departure => {
      if (bay !== '*') {
        if (departure.bay) return bay === departure.bay.slice(4)
      }

      let actual = departure.actualDepartureTime
      let {routeGTFSID, gtfsDirection} = departure.trip
      let id = routeGTFSID + '.' + gtfsDirection

      let minutesDifference = actual.diff(utils.now(), 'minutes')

      if (-2 <= minutesDifference && minutesDifference < 120) {
        if (!directionCount[id]) directionCount[id] = 1
        else directionCount[id]++

        return full || directionCount[id] <= 2
      }
      return false
    }).map(departure => {
      let destination = utils.getDestinationName(departure.trip.destination)
      let serviceData = busDestinations.service[departure.trip.routeGTFSID] || busDestinations.service[departure.routeNumber] || {}

      departure.destination = (serviceData[destination]
        || busDestinations.generic[destination] || destination)

      return departure
    })

  return {trainDepartures, busDepartures, stop}
}

router.get('/half/:suburb/:stopName/:bay', async (req, res) => {
  let data = await getData(req, res, false)

  let time = utils.now()

  res.render('mockups/bus-int-pids/pids', {
    time,
    ...data,
    full: false
  })
})

router.get('/full/:suburb/:stopName/:bay', async (req, res) => {
  let data = await getData(req, res, true)

  let time = utils.now()

  res.render('mockups/bus-int-pids/pids', {
    time,
    ...data,
    full: true
  })
})

router.post('/:type/:suburb/:stopName/:bay', async (req, res) => {
  let data = await getData(req, res, req.params.type === 'full')

  res.json(data)
})

export default router



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
