const utils = require('../../../utils')
const cancellation = require('./handle-cancellation')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration')
const bestStop = require('./find-best-stop')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceAsChanged(db, departureTime, origin, destination, type, changePoint) {
  let now = utils.now()
  if (now.get('hours') <= 2) now.add(-1, 'day')
  let today = utils.getYYYYMMDD(now)

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

    let terminateTypes = ['terminate', 'end']
    let originateTypes = ['originate', 'begin']
    if (originateTypes.includes(type)) type = 'originate'
    if (terminateTypes.includes(type)) type = 'terminate'

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

    console.log(`Marking ${departureTime} ${origin} - ${destination} train as changed. Now ${type}s at ${changePoint}`)
    await discordUpdate(`The ${departureTime} ${origin} - ${destination} service will ${type} ${type === 'originate' ? 'from' : 'at'} ${changePoint} today.`)

    trip.operationDays = today
    trip.originalServiceID = trip.departureTime + trip.destination

    await liveTimetables.replaceDocument(query, trip, {
      upsert: true
    })
  } else {
    console.log('Failed to find trip', query)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service would ${type} ${type === 'originate' ? 'from' : 'at'} ${changePoint} today, but could not match.`)
  }
}

function change(db, text) {
  if (text.includes('delay')) return

  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) (?:to|-) ([\w ]*?)(?:service|train)? will (?:now )?(\w+) (?:early )?(?:at|from|in) ([\w ]*?)(?: at.*?)?(?: today.*?)?(?: due.*?)?(?: and.*?)?.?$/m)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2]) + ' Railway Station'
    let destination = bestStop(service[3]) + ' Railway Station'
    let type = service[4]
    let changePoint = bestStop(service[5])

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
