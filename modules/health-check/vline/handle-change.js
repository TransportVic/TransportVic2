const utils = require('../../../utils')
const async = require('async')

async function setServiceAsChanged(db, departureTime, origin, destination, type, changePoint) {
  let today = utils.now().format('YYYYMMDD')

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

  let query = {
    departureTime, origin, destination,
    mode: 'regional train',
    operationDays: today
  }

  let trip = await gtfsTimetables.findDocument(query)
  if (trip) {
    delete trip._id

    trip.type = 'change'
    trip.tripID = trip.tripID + '-CHANGE'

    if (type === 'originate') {
      trip.message = `CHANGED: WILL ORIGINATE FROM ${changePoint.toUpperCase()}`
    } else if (type === 'terminate') {
      trip.message = `CHANGED: WILL TERMINIATE AT ${changePoint.toUpperCase()}`
    }

    trip.changeType = type
    trip.changePoint = changePoint

    let key = {
      tripID: trip.tripID
    }

    console.log(`Marking ${departureTime} ${origin} - ${destination} train as changed. Now ${type}s at ${changePoint}`)

    await liveTimetables.replaceDocument(key, trip, {
      upsert: true
    })
  } else {
    console.log('Failed to find trip', query)
  }
}

function change(db, text) {
  if (text.includes('delay')) return

  let service = text.match(/((\d{1,2}:\d{1,2}) ([\w ]*?) (?:to|-) ([\w ]*?) service will (?:now )?(\w+) (?:early )?(?:at|from) ([\w ]*?)(?: due.*?)\./)

  if (service) {
    let departureTime = service[1]
    let origin = service[2] + ' Railway Station'
    let destination = service[3] + ' Railway Station'
    let type = service[4]
    let changePoint = service[5]

    setServiceAsChanged(db, departureTime, origin, destination, type, changePoint)
  } else {
    console.log('Could not find match', text)
  }

}

module.exports = change
