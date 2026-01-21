const utils = require('../../../utils.mjs')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration.mjs')
const bestStop = require('./find-best-stop')
const matchTrip = require('./match-trip')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceAsCancelled(db, departureTime, origin, destination, isCoach) {
  let liveTimetables = db.getCollection('live timetables')

  let { trip, today } = await matchTrip(db, departureTime, origin, destination)

  if (trip) {
    // if (isCoach) {
    //   trip.type = 'replacement coach'
    //   trip.isRailReplacementBus = true
    // } else {
      trip.type = 'cancellation'
      trip.cancelled = true
    // }

    global.loggers.mail.info(`Marking ${trip.departureTime} ${origin} - ${destination} train as cancelled.${isCoach ? ' Replacement coaches provided' : ''}`)
    await discordUpdate(`The ${trip.departureTime} ${origin} - ${destination} service has been cancelled today.`)

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
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service has been cancelled, but could not match.`)
  }
}

async function cancellation(db, text) {
  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]+) to ([\w ]+) (?:will|has|is)/)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2].trim()) + ' Railway Station'
    let destination = bestStop(service[3].trim()) + ' Railway Station'
    let isCoach = text.includes('coaches') && text.includes('replace')

    await setServiceAsCancelled(db, departureTime, origin, destination, isCoach)
  }
}

module.exports = cancellation
