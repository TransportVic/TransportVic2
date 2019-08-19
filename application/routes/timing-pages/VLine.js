const express = require('express')
const router = new express.Router()
const getDepartures = require('../../../modules/vline/realtime_arrivals/get_departures')
const moment = require('moment')

router.get('/:stationName', async (req, res) => {
  let station = await res.db.getCollection('vline railway stations').findDocument({
    name: new RegExp(req.params.stationName, 'i')
  })

  if (!station) {
    // TODO: create error page
    return res.end('Could not lookup timings for ' + stn + '. Are you sure V/Line trains stop there?')
  }

  let departures = await getDepartures(station, res.db)
  departures = departures.map(departure => {
    let timeDifference = moment.utc((departure.estimatedDepartureTime || departure.scheduledDepartureTime).diff(moment()))

    if (+timeDifference < 0) departure.prettyTimeToArrival = 'Dep'
    else {
      departure.prettyTimeToArrival = ''
      if (timeDifference.get('hours'))
       departure.prettyTimeToArrival += timeDifference.get('hours') + ' h '
      if (timeDifference.get('minutes'))
        departure.prettyTimeToArrival += timeDifference.get('minutes') + ' min'
      if (!departure.prettyTimeToArrival) departure.prettyTimeToArrival = 'Dep'
    }
    
    return departure
  })

  res.render('timings/vline', {departures})
})

module.exports = router
