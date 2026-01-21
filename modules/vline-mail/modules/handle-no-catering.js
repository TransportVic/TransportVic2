const utils = require('../../../utils.mjs')
const cancellation = require('./handle-cancellation')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration.mjs')
const bestStop = require('./find-best-stop')
const handleTripShorted = require('../../vline-old/handle-trip-shorted')
const matchTrip = require('./match-trip')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setNoCatering(db, departureTime, origin, destination) {
  let liveTimetables = db.getCollection('live timetables')

  let { trip, today } = await matchTrip(db, departureTime, origin, destination)

  if (trip) {
    trip.cateringUnavailable = true

    global.loggers.mail.info(`Marking ${trip.departureTime} ${origin} - ${destination} train as catering unavailable.`)
    await discordUpdate(`The ${trip.departureTime} ${origin} - ${destination} service will operate without catering today.`)

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
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service will operate without catering today, but could not match.`)
  }
}

async function change(db, text) {
  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]+) to ([\w ]+) (?:will|has|is)/)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2].trim()) + ' Railway Station'
    let destination = bestStop(service[3].trim()) + ' Railway Station'

    await setNoCatering(db, departureTime, origin, destination)
  }
}

module.exports = change
