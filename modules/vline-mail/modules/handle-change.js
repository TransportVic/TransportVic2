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

let terminateTypes = ['terminate', 'terminating', 'end', 'ending']
let originateTypes = ['originate', 'originating', 'begin', 'beginning']

async function setServiceAsChanged(db, departureTime, origin, destination, modifications) {
  let liveTimetables = db.getCollection('live timetables')

  let { trip, nspTrip, today } = await matchTrip(db, departureTime, origin, destination)

  if (trip) {
    let newOrigin = origin, newDestination = destination
    modifications.forEach(modification => {
      if (modification.type === 'originate') newOrigin = modification.changePoint + ' Railway Station'
      else if (modification.type === 'terminate') newDestination = modification.changePoint + ' Railway Station'
    })

    let tripOrigin = trip.origin, tripDestination = trip.destination

    global.loggers.mail.info(`Marking ${trip.departureTime} ${tripOrigin} - ${tripDestination} train as changed: Now ${modifications.map(m => `${m.type}s at ${m.changePoint}`).join(' & ')}`)

    if (modifications.length === 1) {
      let firstMod = modifications[0]
      await discordUpdate(`The ${trip.departureTime} ${tripOrigin} - ${tripDestination} service will ${firstMod.type} ${firstMod.type === 'originate' ? 'from' : 'at'} ${firstMod.changePoint} today.`)
    } else {
      await discordUpdate(`The ${trip.departureTime} ${tripOrigin} - ${tripDestination} service has been altered: Now ${modifications.map(m => `${m.type}s at ${m.changePoint}`).join(', ')}`)
    }

    handleTripShorted(trip, {
      origin: newOrigin,
      destination: newDestination,
      runID: trip.runID
    }, nspTrip, liveTimetables, today)
  } else {
    let identifier = {
      departureTime, origin, destination,
      operationDays: today
    }

    let firstMod = modifications[0]
    global.loggers.mail.err('Failed to find trip', identifier)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service would ${firstMod.type} ${firstMod.type === 'originate' ? 'from' : 'at'} ${firstMod.changePoint} today, but could not match.`)
  }
}

async function change(db, text) {
  if (text.includes('delay')) return

  let service = (text + '.').match(/(\d{1,2}[:.]\d{1,2}) ([\w ]+) to ([\w ]+) will (?:now .*?)?(?:be )?(\w+) (?:earl\w* )?(?:at|from|in|out of) ([\w ]*?)(?: at.*?)?(?: [\d.:]*)?(?: today.*?)?(?: due.*?)?(?: and.*?)?\./m)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2].trim()) + ' Railway Station'
    let destination = bestStop(service[3].trim()) + ' Railway Station'

    let type = service[4]

    if (originateTypes.includes(type)) type = 'originate'
    if (terminateTypes.includes(type)) type = 'terminate'

    let modifications = [{
      type,
      changePoint: bestStop(service[5])
    }]

    if (type === 'originate' && terminateTypes.some(t => text.includes(` ${t} `))) {
      let match = text.match(/(?:terminate|end) at ([\w ]+)(?:today)?\.?/)
      if (match) {
        let terminatingLocation = bestStop(match[1])
        modifications.push({
          type: 'terminate',
          changePoint: terminatingLocation
        })
      }
    }

    await setServiceAsChanged(db, departureTime, origin, destination, modifications)
  } else {
    service = text.match(/(\d{1,2}[:.]\d{1,2})/)
    if (service && service.includes('terminate')) {
      await cancellation(text, db)

      global.loggers.mail.err('Was told train was terminating early but not where, marking as cancelled')
    } else {
      global.loggers.mail.err('Could not find match', text)
    }
  }

}

module.exports = change
