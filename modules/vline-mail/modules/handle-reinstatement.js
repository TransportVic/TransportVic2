const utils = require('../../../utils.mjs')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration.mjs')
const bestStop = require('./find-best-stop')
const matchTrip = require('./match-trip')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceAsReinstated(db, departureTime, origin, destination) {
  let liveTimetables = db.getCollection('live timetables')

  let { trip, today } = await matchTrip(db, departureTime, origin, destination, true)

  if (trip) {
    global.loggers.mail.info(`Marking ${trip.departureTime} ${origin} - ${destination} train as reinstated.`)
    await discordUpdate(`The ${trip.departureTime} ${origin} - ${destination} service has been reinstated today.`)

    delete trip.cancelled
    delete trip.type

    trip.stopTimings.forEach(stop => {
      delete stop.cancelled
      delete stop.modifications
    })

    await liveTimetables.replaceDocument({
      _id: trip._id
    }, trip)
  } else {
    global.loggers.mail.err(`Could not mark ${departureTime} ${origin} - ${destination} as reinstated`)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service would be reinstated today, but could not match.`)
  }
}

async function reinstatement(db, text) {
  let service = text.replace(/ and .*/, '').match(/(\d{1,2}[:.]\d{1,2}) ([\w ]+) to ([\w ]+) ?(?:will|has|is)/)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2].trim()) + ' Railway Station'
    let destination = bestStop(service[3].trim()) + ' Railway Station'

    await setServiceAsReinstated(db, departureTime, origin, destination)
  }
}

module.exports = reinstatement
