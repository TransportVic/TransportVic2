const utils = require('../../../utils')
const cancellation = require('./handle-cancellation')
const async = require('async')

async function setServiceAsChanged(db, departureTime, origin, destination, type, changePoint) {
  let today = utils.now().format('YYYYMMDD')

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')

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

    trip.type = 'change'
    trip.tripID = trip.tripID + '-CHANGE'

    let terminateTypes = ['terminate']
    let originateTypes = ['originate', 'begin']
    if (originateTypes.includes(type)) {
      type = 'originate'
      trip.message = `CHANGED: WILL ORIGINATE FROM ${changePoint.toUpperCase()}`
    } else if (type === 'terminate') {
      trip.message = `CHANGED: WILL TERMINIATE AT ${changePoint.toUpperCase()}`
    }

    trip.changeType = type
    trip.changePoint = changePoint

    let hasSeen = false
    if (type === 'originate') {
      trip.stopTimings = trip.stopTimings.map(stop => {
        if (hasSeen) return stop
        if (stop.stopName.slice(0, -16) === changePoint) {
          hasSeen = true
          return stop
        }
        stop.cancelled = true
        return stop
      })
    } else {
      trip.stopTimings = trip.stopTimings.map(stop => {
        if (hasSeen) {
          stop.cancelled = true
          return stop
        }
        if (stop.stopName.slice(0, -16) === changePoint) {
          hasSeen = true
          return stop
        }
        return stop
      })
    }

    let key = {
      tripID: trip.tripID
    }

    console.log(`Marking ${departureTime} ${origin} - ${destination} train as changed. Now ${type}s at ${changePoint}`)

    trip.operationDays = [today]

    await liveTimetables.replaceDocument(key, trip, {
      upsert: true
    })
  } else {
    console.log('Failed to find trip', query)
  }
}

function change(db, text) {
  if (text.includes('delay')) return

  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) (?:to|-) ([\w ]*?)(?:service|train)? will (?:now )?(\w+) (?:early )?(?:at|from) ([\w ]*?)(?: at.*?)?(?: today.*?)?(?: due.*?)?(?: and.*?)?\./)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = service[2].trim() + ' Railway Station'
    let destination = service[3].trim() + ' Railway Station'
    let type = service[4]
    let changePoint = service[5]

    setServiceAsChanged(db, departureTime, origin, destination, type, changePoint)
  } else {
    service = text.match(/(\d{1,2}[:.]\d{1,2})/)
    if (service && service.includes('terminate')) {
      cancellation(text, db)
      console.log('Was told train was terminating early but not where, marking as cancelled')
    } else {
      console.log('Could not find match', text)
    }
  }

}

module.exports = change
