const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/metro-trains/get-departures')
const moment = require('moment')
const utils = require('../../../utils')

async function loadDepartures(req, res) {
  const station = await res.db.getCollection('stops').findDocument({
    codedName: req.params.stationName + '-railway-station'
  })

  if (!station || !station.bays.find(bay => bay.mode === 'metro train')) {
    return res.status(404).render('errors/no-stop')
  }

  let departures = await getDepartures(station, res.db)

  departures = departures.map(departure => {
    const timeDifference = moment.utc(departure.actualDepartureTime.diff(utils.now()))

    if (+timeDifference <= 60000) departure.prettyTimeToArrival = 'Now'
    else {
      departure.prettyTimeToArrival = ''
      if (timeDifference.get('hours')) departure.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes')) departure.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
    }

    departure.headwayDevianceClass = 'unknown'
    if (departure.estimatedDepartureTime) {
      departure.headwayDeviance = departure.scheduledDepartureTime.diff(departure.estimatedDepartureTime, 'minutes')

      // trains cannot be early
      let lateThreshold = 5
      if (departure.headwayDeviance <= -lateThreshold) { // <= 5min counts as late
        departure.headwayDevianceClass = 'late'
      } else {
        departure.headwayDevianceClass = 'on-time'
      }
    }

    let {trip} = departure
    departure.codedLineName = utils.encodeName(trip.routeName)

    let origin = trip.trueOrigin.slice(0, -16)
    let originDepartureTime = trip.trueDepartureTime
    let destination = trip.trueDestination.slice(0, -16)
    let destinationArrivalTime = trip.trueDestinationArrivalTime

    let currentStation = departure.trip.stopTimings.find(tripStop => tripStop.stopName === station.stopName)
    let {stopGTFSID} = currentStation
    let firstStop = departure.trip.stopTimings[0]

    let fss = departure.trip.stopTimings.find(tripStop => tripStop.stopName === 'Flinders Street Railway Station')
    if (departure.trip.direction === 'Down' && fss) firstStop = fss
    let minutesDiff = currentStation.departureTimeMinutes - firstStop.departureTimeMinutes

    let tripStart = departure.scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    // if (departure.trip.stopTimings[0].departureTimeMinutes > 1440) {
    //   console.log(departure.trip)
    //   operationDate = tripStart.add(-1, 'day').format('YYYYMMDD')
    //   // Note: do not attempt to fix wrong day thing as timetables are screwed up on PTV's end.
    //   // Example: TDN1069 on Saturday morning when loaded returns some 17.10 down MDD
    // }

    departure.tripURL = `${utils.encodeName(origin)}/${originDepartureTime}/`
      + `${utils.encodeName(destination)}/${destinationArrivalTime}/`
      + `${operationDate}/#stop-${stopGTFSID}`

    departure.destinationURL = `/metro/timings/${utils.encodeName(trip.trueDestination).slice(0, -16)}`

    return departure
  })

  return {
    departures,
    station,
    placeholder: 'Destination or platform'
  }
}

router.get('/:stationName', async (req, res) => {
  let response = await loadDepartures(req, res)
  if (response) res.render('timings/metro-trains', response)
})

router.post('/:stationName', async (req, res) => {
  res.render('timings/templates/metro-trains', await loadDepartures(req, res))
})

module.exports = router
