const utils = require('../../../utils')
const cancellation = require('./handle-cancellation')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration')
const bestStop = require('./find-best-stop')
const findTrip = require('../../vline/find-trip')
const handleTripShorted = require('../../vline/handle-trip-shorted')
const { getDayOfWeek } = require('../../../public-holidays')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

let terminateTypes = ['terminate', 'terminating', 'end', 'ending']
let originateTypes = ['originate', 'originating', 'begin', 'beginning']

async function setServiceAsChanged(db, departureTime, origin, destination, modifications) {
  let now = utils.now()
  if (now.get('hours') <= 2) now.add(-1, 'day')
  let today = utils.getYYYYMMDD(now)
  let operationDay = await getDayOfWeek(now)

  let gtfsTimetables = db.getCollection('gtfs timetables')
  let liveTimetables = db.getCollection('live timetables')
  let timetables = db.getCollection('timetables')

  if (departureTime.split(':')[0].length == 1) {
    departureTime = `0${departureTime}`
  }


  let trip
  let nspTrip = await findTrip(timetables, operationDay, origin, destination, departureTime)

  if (nspTrip) {
    trip = await liveTimetables.findDocument({
      operationDays: today,
      runID: nspTrip.runID,
      mode: 'regional train'
    }) || await findTrip(gtfsTimetables, today, origin, destination, departureTime)

    if (trip) {
      trip.runID = nspTrip.runID
      trip.vehicle = nspTrip.vehicle
    }
  } else {
    trip = await findTrip(liveTimetables, today, origin, destination, departureTime)
  }

  if (trip) {
    delete trip._id

    let newOrigin = origin, newDestination = destination
    modifications.forEach(modification => {
      if (modification.type === 'originate') newOrigin = modification.changePoint + ' Railway Station'
      else if (modification.type === 'terminate') newDestination = modification.changePoint + ' Railway Station'
    })

    global.loggers.mail.info(`Marking ${departureTime} ${origin} - ${destination} train as changed: Now ${modifications.map(m => `${m.type}s at ${m.changePoint}`).join(' & ')}`)

    if (modifications.length === 1) {
      let firstMod = modifications[0]
      await discordUpdate(`The ${departureTime} ${origin} - ${destination} service will ${firstMod.type} ${firstMod.type === 'originate' ? 'from' : 'at'} ${firstMod.changePoint} today.`)
    } else {
      await discordUpdate(`The ${departureTime} ${origin} - ${destination} service has been altered: Now ${modifications.map(m => `${m.type}s at ${m.changePoint}`).join(', ')}`)
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

function change(db, text) {
  if (text.includes('delay')) return

  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) to ([\w ]*?)(?:service|train)? will (?:now )?(?:be )?(\w+) (?:early )?(?:at|from|in) ([\w ]*?)(?: at.*?)?(?: [\d.:]*)?(?: today.*?)?(?: due.*?)?(?: and.*?)?.?$/m)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2]) + ' Railway Station'
    let destination = bestStop(service[3]) + ' Railway Station'

    let type = service[4]

    if (originateTypes.includes(type)) type = 'originate'
    if (terminateTypes.includes(type)) type = 'terminate'

    let modifications = [{
      type,
      changePoint: bestStop(service[5])
    }]

    if (type === 'originate' && terminateTypes.some(t => text.includes(t))) {
      let terminatingLocation = bestStop(text.match(/(?:terminate|end) at ([\w ]+)(?:today)?\.?/)[1])
      modifications.push({
        type: 'terminate',
        changePoint: terminatingLocation
      })
    }

    setServiceAsChanged(db, departureTime, origin, destination, modifications)
  } else {
    service = text.match(/(\d{1,2}[:.]\d{1,2})/)
    if (service && service.includes('terminate')) {
      cancellation(text, db)

      global.loggers.mail.err('Was told train was terminating early but not where, marking as cancelled')
    } else {
      global.loggers.mail.err('Could not find match', text)
    }
  }

}

module.exports = change
