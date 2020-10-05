const utils = require('../../../utils')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration')
const bestStop = require('./find-best-stop')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceAsCancelled(db, departureTime, origin, destination, isCoach) {
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
    if (isCoach) {
      trip.type = 'replacement coach'
      trip.isRailReplacementBus = true
      trip.tripID = trip.tripID + '-RRB'
    } else {
      trip.type = 'cancellation'
      trip.cancelled = true
      trip.tripID = trip.tripID.replace('1-', '5-') + '-cancelled'
    }

    console.log(`Marking ${departureTime} ${origin} - ${destination} train as cancelled.${isCoach ? ' Replacement coaches provided' : ''}`)
    await discordUpdate(`The ${departureTime} ${origin} - ${destination} service has been cancelled today.`)

    trip.operationDays = today

    await liveTimetables.replaceDocument(query, trip, {
      upsert: true
    })
  } else {
    console.log('Failed to find trip', query)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service has been cancelled, but could not match.`)
  }
}

async function cancellation(db, text) {
  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) to ([\w ]*?) (?:service|train|will|has)/)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2]) + ' Railway Station'
    let destination = bestStop(service[3]) + ' Railway Station'
    let isCoach = text.includes('coaches') && text.includes('replace')
    await setServiceAsCancelled(db, departureTime, origin, destination, isCoach)
  }
}

module.exports = cancellation
