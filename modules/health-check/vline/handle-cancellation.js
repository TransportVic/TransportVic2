const utils = require('../../../utils')
const async = require('async')

async function setServicesAsCancelled(db, services) {
  let today = utils.now().format('YYYYMMDD')

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  await async.forEach(services, async service => {
    let {departureTime, origin, destination, isCoach} = service

    if (departureTime.split(':')[0].length == 1) {
      departureTime = `0${departureTime}`
    }

    let query = {
      departureTime, origin, destination,
      mode: 'regional train',
      operationDays: today
    }

    let trip = await gtfsTimetables.findDocument(query)
    if (trip) {
      delete trip._id
      if (isCoach) {
        trip.type = 'replacement coach'
        trip.isTrainReplacement = true
        trip.tripID = trip.tripID + '-RRB'
      } else {
        trip.type = 'cancellation'
        trip.cancelled = true
        trip.tripID = trip.tripID.replace('1-', '5-') + '-cancelled'
      }

      let key = {
        tripID: trip.tripID
      }

      console.log(`Marking ${departureTime} ${origin} - ${destination} train as cancelled.${isCoach ? ' Replacement coaches provided' : ''}`)

      await liveTimetables.replaceDocument(key, trip, {
        upsert: true
      })
    } else {
      console.log('Failed to find trip', query)
    }
  })
}

async function cancellation(db, text) {
  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) (?:to|-) ([\w ]*?) (?:service|train|will|has)/)
  let matches = []

  if (service) {
    let departureTime = service[1]
    let origin = service[2] + ' Railway Station'
    let destination = service[3] + ' Railway Station'
    let isCoach = text.includes('coaches') && text.includes('replace')
    matches.push({departureTime, origin, destination, isCoach})
  } else {
    if (text.match(/services (?:will not run|has been cancelled)/)) {
      let services = text.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (?:to|-) ([\w ]*?) /g)
      if (services.length === 0) return console.log('Could not find match', text)

      services.forEach(service => {
        let parts = service.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (?:to|-) ([\w ]*?) /)
        let departureTime = parts[1]
        let origin = parts[2] + ' Railway Station'
        let destination = parts[3] + ' Railway Station'
        let isCoach = text.includes('coaches') && text.includes('replace')
        matches.push({departureTime, origin, destination, isCoach})
      })
    }
  }

  await setServicesAsCancelled(db, matches)
}

module.exports = cancellation
