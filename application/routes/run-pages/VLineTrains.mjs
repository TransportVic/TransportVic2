import express from 'express'
import utils from '../../../utils.mjs'
import guessPlatform from '../../../modules/vline-old/guess-scheduled-platforms.mjs'

const router = new express.Router()

async function pickBestTrip(data, db) {
  let tripStartTime = utils.parseTime(`${data.operationDays} ${data.departureTime}`, 'YYYYMMDD HH:mm')

  let originStop = await db.getCollection('stops').findDocument({
    cleanName: data.origin,
    // cleanName: data.origin + '-railway-station',
    'bays.mode': 'regional train'
  })
  let destinationStop = await db.getCollection('stops').findDocument({
    cleanName: data.destination,
    // cleanName: data.destination + '-railway-station',
    'bays.mode': 'regional train'
  })

  if (!originStop || !destinationStop) return null

  let gtfsQuery = {
    mode: 'regional train',
    operationDays: data.operationDays,
    origin: originStop.stopName,
    departureTime: data.departureTime,
    destination: destinationStop.stopName,
    destinationArrivalTime: data.destinationArrivalTime
  }

  let liveTrip = await db.getCollection('live timetables').findDocument(gtfsQuery)
  let gtfsTrip = await db.getCollection('gtfs timetables').findDocument(gtfsQuery)

  let referenceTrip = liveTrip || gtfsTrip

  let needsRedirect = referenceTrip ? (referenceTrip.origin !== originStop.stopName
    || referenceTrip.destination !== destinationStop.stopName
    || referenceTrip.departureTime !== data.departureTime
    || referenceTrip.destinationArrivalTime !== data.destinationArrivalTime) : false

  if (liveTrip) return { trip: liveTrip, tripStartTime, isLive: true, needsRedirect, originStop }
  else return gtfsTrip ? { trip: gtfsTrip, tripStartTime, isLive: false, needsRedirect, originStop } : null
}

async function addTripData(db, tripData) {
  let { trip, tripStartTime, isLive, originStop } = tripData

  let firstDepartureTime = trip.stopTimings.find(stop => stop.stopName === originStop.stopName).departureTimeMinutes
  trip.stopTimings = trip.stopTimings.map(stop => {
    stop.pretyTimeToDeparture = ''

    if (!stop.platform) {
      stop.platform = guessPlatform(stop.stopName.slice(0, -16), stop.departureTimeMinutes, trip.routeName, trip.direction)
      if (stop.platform) stop.platform += '?'
    }

    if (trip.cancelled || stop.cancelled) {
      stop.headwayDevianceClass = 'cancelled'

      return stop
    } else {
      stop.headwayDevianceClass = 'unknown'
    }

    if (!isLive || (isLive && stop.estimatedDepartureTime)) {
      let scheduledDepartureTime = tripStartTime.clone().add((stop.departureTimeMinutes || stop.arrivalTimeMinutes) - firstDepartureTime, 'minutes')
      let estimatedDepartureTime = stop.estimatedDepartureTime

      stop.headwayDevianceClass = utils.findHeadwayDeviance(scheduledDepartureTime, estimatedDepartureTime, {
        early: 1,
        late: 5
      })

      if (isLive && !stop.estimatedDepartureTime) return stop
      stop.pretyTimeToDeparture = utils.prettyTime(estimatedDepartureTime || scheduledDepartureTime, true, true)
    }
    return stop
  })
}

router.get('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  await addTripData(res.db, tripData)
  res.render('runs/vline', { trip: tripData.trip })
})

router.post('/:origin/:departureTime/:destination/:destinationArrivalTime/:operationDays', async (req, res) => {
  let tripData = await pickBestTrip(req.params, res.db)
  if (!tripData) return res.status(404).render('errors/no-trip')

  await addTripData(res.db, tripData)
  res.render('runs/templates/vline', { trip: tripData.trip })
})

export default router