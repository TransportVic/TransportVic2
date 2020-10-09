const utils = require('../../../utils')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration')
const bestStop = require('./find-best-stop')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceAsReinstated(db, service) {
  let now = utils.now()
  if (now.get('hours') <= 2) now.add(-1, 'day')
  let today = utils.getYYYYMMDD(now)

  let liveTimetables = db.getCollection('live timetables')

  let {departureTime, origin, destination} = service

  if (departureTime.split(':')[0].length == 1) {
    departureTime = `0${departureTime}`
  }

  let query = {
    departureTime, origin, destination,
    mode: 'regional train',
    operationDays: today,
    type: 'cancellation'
  }

  let trip = await liveTimetables.findDocument(query)

  if (trip) {
    console.log(`Marking ${departureTime} ${origin} - ${destination} train as reinstated.`)
    await discordUpdate(`The ${departureTime} ${origin} - ${destination} service as been reinstated today.`)

    await liveTimetables.deleteDocument({ _id: trip._id })
  } else {
    console.log(`Could not mark ${departureTime} ${origin} - ${destination} as reinstated`, query)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service would be reinstated today, but could not match.`)
  }
}

async function reinstatement(db, text) {
  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) to ([\w ]*?) (?:service|train|will|has|is)/)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2]) + ' Railway Station'
    let destination = bestStop(service[3]) + ' Railway Station'

    await setServiceAsReinstated(db, {departureTime, origin, destination})
  }
}

module.exports = reinstatement
