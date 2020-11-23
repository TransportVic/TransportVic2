const utils = require('../../../utils')
const cancellation = require('./handle-cancellation')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration')
const bestStop = require('./find-best-stop')
const matchTrip = require('./match-trip')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceNonStop(db, departureTime, origin, destination, skipping) {
  let liveTimetables = db.getCollection('live timetables')

  let { trip, today } = await matchTrip(db, departureTime, origin, destination)

  if (trip) {
    trip.type = 'pattern-altered'

    trip.stopTimings = trip.stopTimings.map(stop => {
      stop.cancelled = stop.stopName.slice(0, -16) === skipping
      return stop
    })

    global.loggers.mail.info(`Marking ${trip.departureTime} ${origin} - ${destination} train as not stopping at ${skipping}`)
    await discordUpdate(`The ${trip.departureTime} ${origin} - ${destination} service will not stop at ${skipping} today.`)

    trip.operationDays = today

    await liveTimetables.replaceDocument({
      operationDays: today,
      runID: trip.runID,
      mode: 'regional train'
    }, trip, {
      upsert: true
    })
  } else {
    let identifier = {
      departureTime, origin, destination,
      operationDays: today
    }

    global.loggers.mail.err('Failed to find trip', identifier)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service would not stop at ${skipping} today, but could not match.`)
  }
}

function nonStop(db, text) {
  text = text.replace('will run express through', 'will not stop at')
  let service = (text + '.').match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) to ([\w ]*?)(?:service|train)? will not stop at ([\w ]*?)(?: today)?\./m)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2]) + ' Railway Station'
    let destination = bestStop(service[3]) + ' Railway Station'
    let skipping = bestStop(service[4])

    setServiceNonStop(db, departureTime, origin, destination, skipping)
  }
}

module.exports = nonStop
