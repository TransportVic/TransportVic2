const utils = require('../../../utils')
const cancellation = require('./handle-cancellation')
const async = require('async')
const postDiscordUpdate = require('../../discord-integration')
const bestStop = require('./find-best-stop')
const findTrip = require('../../vline/find-trip')
const { getDayOfWeek } = require('../../../public-holidays')

async function discordUpdate(text) {
  await postDiscordUpdate('vlineInform', text)
}

async function setServiceNonStop(db, departureTime, origin, destination, skipping) {
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
    })

    if (!trip) {
      trip = await findTrip(gtfsTimetables, today, origin, destination, departureTime)
    }

    if (trip) {
      trip.runID = nspTrip.runID
      trip.vehicle = nspTrip.vehicle
    }
  } else {
    trip = await findTrip(liveTimetables, today, origin, destination, departureTime)
  }

  if (trip) {
    delete trip._id

    trip.type = 'pattern-altered'

    trip.stopTimings = trip.stopTimings.map(stop => {
      stop.cancelled = stop.stopName.slice(0, -16) === skipping
      return stop
    })

    console.log(`Marking ${departureTime} ${origin} - ${destination} train as not stopping at ${skipping}`)
    await discordUpdate(`The ${departureTime} ${origin} - ${destination} service will not stop at ${skipping} today.`)

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

    console.log('Failed to find trip', identifier)
    await discordUpdate(`Was told the ${departureTime} ${origin} - ${destination} service would not stop at ${skipping} today, but could not match.`)
  }
}

function nonStop(db, text) {
  text = text.replace('will run express through', 'will not stop at')
  let service = text.match(/(\d{1,2}[:.]\d{1,2}) ([\w ]*?) to ([\w ]*?)(?:service|train)? will not stop at ([\w ]*?)(?: today)?.?$/m)

  if (service) {
    let departureTime = service[1].replace('.', ':')
    let origin = bestStop(service[2]) + ' Railway Station'
    let destination = bestStop(service[3]) + ' Railway Station'
    let skipping = bestStop(service[4])

    setServiceNonStop(db, departureTime, origin, destination, skipping)
  }
}

module.exports = nonStop
