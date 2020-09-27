const utils = require('../../../utils')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceAsReducedCapacity(db, departureTime, origin, destination, capacity) {
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

    trip.type = 'capacity reduction'
    trip.capacity = capacity
    trip.tripID = trip.tripID + '-CAP'

    let key = {
      tripID: trip.tripID
    }

    console.log(`Marking ${departureTime} ${origin} - ${destination} train as reduced capacity - ${capacity} carriages.`)
    await discordUpdate(`The ${departureTime} ${origin} - ${destination} service will run with a reduced capacity of ${capacity} carriages today`)

    trip.operationDays = [today]

    await liveTimetables.replaceDocument(key, trip, {
      upsert: true
    })
  } else {
    console.log('Failed to find trip', query)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service has a capacity reduction, but could not match.`)
  }
}

function reduction(db, text) {
  let service = text.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (?:to|-) ([\w ]*?) service/)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = service[2].trim() + ' Railway Station'
    let destination = service[3].trim() + ' Railway Station'
    let capacity = text.match(/capacity of (\d+) carriages?/)[1]

    setServiceAsReducedCapacity(db, departureTime, origin, destination, capacity)
  } else {
    console.log('Could not find match', text)
  }

}

module.exports = reduction
