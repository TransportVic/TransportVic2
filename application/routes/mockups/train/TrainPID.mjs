import TimedCache from '../../../../TimedCache.mjs'
import utils from '../../../../utils.mjs'
import getLineStops from '../../../../additional-data/route-stops.mjs'
import express from 'express'

const router = new express.Router()

let dayCache = new TimedCache(1000 * 120)

let northernGroup = [
  'Craigieburn',
  'Sunbury',
  'Upfield',
  'Werribee',
  'Williamstown',
  'Showgrounds/Flemington',
  'Flemington Racecourse'
]

let crossCityGroup = [
  'Werribee',
  'Williamstown',
  'Frankston'
]

let gippslandLines = [
  'Bairnsdale',
  'Traralgon'
]

let cliftonHillGroup = [
  'Hurstbridge',
  'Mernda'
]

let caulfieldGroup = [
  'Cranbourne',
  'Pakenham',
  'Frankston',
  'Sandringham'
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

router.get('/comeng/:runID', async (req, res) => {
  res.render('mockups/train-pids/comeng')
})

router.get('/hcmt/:runID', async (req, res) => {
  res.render('mockups/train-pids/hcmt')
})

router.post('/:type/:runID', async (req, res) => {
  let minutesPastMidnight = utils.getMinutesPastMidnightNow()
  let trip
  let liveTimetables = res.db.getCollection('live timetables')

  let runID = req.params.runID

  // if (dayCache.get(runID)) {
  trip = await liveTimetables.findDocument({ operationDays: utils.getYYYYMMDDNow(), runID })
  //   if (new Date() - trip.updateTime > 2 * 60 * 1000) trip = null // If its older than 2min get a new copy
  // }

  // if (!trip) {
  //   console.log({ operationDays: dayCache.get(runID), runID })
  // }

  if (!trip) return res.json(null)

  let routeName = trip.routeName
  let tripStopNames = trip.stopTimings.map(stop => stop.stopName.slice(0, -16))

  let isUp = trip.direction === 'Up'
  let lineStops = getLineStops(routeName)
  if (isUp) lineStops = lineStops.slice(0).reverse()

  let tripStartIndex = tripStopNames.indexOf(trip.origin.slice(0, -16))
  let tripEndIndex = tripStopNames.indexOf(trip.destination.slice(0, -16))

  let viaCityLoop = tripStopNames.includes('Flagstaff') || tripStopNames.includes('Parliament')

  let fixedLineStops

  if (viaCityLoop) {
    let cityLoopStops = tripStopNames.filter(e => cityLoopStations.includes(e) || e === 'Flinders Street')
    let nonCityLoopLineStops = lineStops.filter(e => !cityLoopStations.includes(e) && e !== 'Flinders Street')

    if (isUp) {
      fixedLineStops = nonCityLoopLineStops.concat(cityLoopStops)
    } else {
      fixedLineStops = [...cityLoopStops, ...nonCityLoopLineStops]
    }
  } else {
    let nonCityLoopLineStops = lineStops.filter(e => !cityLoopStations.includes(e) && e !== 'Flinders Street')

    if (northernGroup.includes(routeName)) {
      if (isUp) {
        if (trip.trueDestination.slice(0, -16) === 'Flinders Street') {
          fixedLineStops = [...nonCityLoopLineStops, 'Southern Cross', 'Flinders Street']
        } else {
          fixedLineStops = [...nonCityLoopLineStops, 'Southern Cross']
        }
      } else {
        fixedLineStops = ['Flinders Street', 'Southern Cross', ...nonCityLoopLineStops]
      }
    } else {
      if (isUp) {
        fixedLineStops = [...nonCityLoopLineStops, 'Flinders Street']
      } else {
        fixedLineStops = ['Flinders Street', ...nonCityLoopLineStops]
      }
    }
  }

  let lineStartIndex = fixedLineStops.indexOf(trip.origin.slice(0, -16))
  let lineEndIndex = fixedLineStops.indexOf(trip.destination.slice(0, -16))
  let relevantLineStops = fixedLineStops.slice(lineStartIndex, lineEndIndex + 1)

  let relevantTripStops = trip.stopTimings

  let now = +new Date()

  let tripStops = relevantTripStops.map(stop => {
    return {
      stopName: stop.stopName.slice(0, -16),
      actualDepartureTimeMS: stop.actualDepartureTimeMS
    }
  })

  res.json({
    routeName,
    lineStops: relevantLineStops,
    tripStops
  })
})

export default router