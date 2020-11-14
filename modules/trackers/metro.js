const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getMetroDepartures = require('../metro-trains/get-departures')
const getStoppingPattern = require('../utils/get-stopping-pattern')
const { findTrip } = getMetroDepartures
const metroConsists = require('../../additional-data/metro-tracker/metro-consists')
const stops = require('../../additional-data/metro-tracker/stops')
const schedule = require('./scheduler')
const ptvAPI = require('../../ptv-api')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops
let metroTrips

function runNightNetwork() {
  let minutes = utils.getMinutesPastMidnightNow()
  let dayOfWeek = utils.getDayOfWeek(utils.now())

  if (minutes >= 300 || minutes <= 60) return true

  if (['Sat', 'Sun'].includes(dayOfWeek)) { // Considering the true day, NN runs on sat & sun morn
    return minutes < 300 // 2359 - 0459
  }

  return false
}

let stopNames = Object.keys(stops)

function pickRandomStop() {
  return utils.shuffle(stopNames)[0]
}

async function getDepartures(stop) {
  if (!runNightNetwork()) return

  let stopCode = stops[stop]
  let stopData = await dbStops.findDocument({ stopName: stop + ' Railway Station' })
  await getMetroDepartures(stopData, database) // To preload disruptions and whatnot

  let stopURL = urls.metroTracker.format(stopCode, await ptvAPI.getPTVKey(urls.metroTrackerBase))
  let data = JSON.parse(await utils.request(stopURL))
  let viableDepartures = data.departures.filter(departure => !!departure.run.vehicle_descriptor)
  await async.forEachOf(viableDepartures, async (viableDeparture, i) => {
    let scheduledDepartureTime = utils.parseTime(viableDeparture.scheduled_departure_utc)
    let { run, route } = viableDeparture
    let ptvRunID = run.run_id

    let { trip, runID } = await findTrip(database, viableDeparture, scheduledDepartureTime, run, ptvRunID, {
      route_name: route.short_label,
      route_id: route.id
    }, stopData, [], [])

    let currentStation = trip.stopTimings.find(tripStop => tripStop.stopName === stopData.stopName)
    let {stopGTFSID} = currentStation
    let firstStop = trip.stopTimings[0]

    let fss = trip.stopTimings.find(tripStop => tripStop.stopName === 'Flinders Street Railway Station')
    if (trip.direction === 'Down' && fss) firstStop = fss
    let minutesDiff = currentStation.departureTimeMinutes - firstStop.departureTimeMinutes

    let tripStart = scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
    let operationDate = utils.getYYYYMMDD(tripStart)

    let query = {
      date: operationDate,
      runID
    }

    let finalConsist = []
    let consist = run.vehicle_descriptor.id
    if (consist.match(/train\d+/)) {
      // For now we don't know what this means so skip it
      return global.loggers.trackers.metro.warn('Encountered strange train', {
        consist,
        runID
      })
    }

    let carriages = consist.split('-')

    if (carriages.includes('313M') || carriages.includes('333M')) { // 313-333 withdrawn, replaced by 314-334
      let exclude = ['333M', '313M', '314M', '334M', '1007T', '1017T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1017T', ...carriages, '314M', '334M']
    }

    if (carriages.includes('330M') || carriages.includes('350M') || carriages.includes('691M') || carriages.includes('692M')) { // 691-692 withdrawn, replaced by 330-350
      let exclude = ['330M', '350M', '691M', '692M', '1025T', '1196T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1025T', ...carriages, '330M', '350M']
    }

    if (carriages.includes('527M') || carriages.includes('528M')) { // 695-696 withdrawn, replaced by 527-528
      let exclude = ['527M', '528M', '695M', '696M', '1114T', '1198T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1114T', ...carriages, '527M', '528M']
    }

    if (carriages.length <= 2) {
      finalConsist = metroConsists.filter(consist => carriages.some(carriage => consist.includes(carriage))).reduce((a, e) => {
        return a.concat(e)
      }, [])
    } else {
      let mCars = carriages.filter(carriage => carriage.endsWith('M'))
      let tCars = carriages.filter(carriage => carriage.endsWith('T'))
      let mCarNumbers = mCars.map(carriage => parseInt(carriage.slice(0, -1)))
      let anyPair = mCarNumbers.find(carriage => {
        // Only consider odd carriage as lower & find if it has + 1
        return (carriage % 2 === 1) && mCarNumbers.some(other => other == carriage + 1)
      })

      let mtmMatched
      if (anyPair) {
        mtmMatched = metroConsists.find(consist => consist.includes(anyPair + 'M'))
      } else {
        let consistFromTCars = tCars.map(tCar => metroConsists.find(consist => consist.includes(tCar)))
        mtmMatched = consistFromTCars.find(potentialConsist => {
          return mCars.includes(potentialConsist[0]) && mCars.includes(potentialConsist[2])
        })
      }

      if (mtmMatched) {
        finalConsist = finalConsist.concat(mtmMatched)

        let otherCars = carriages.filter(carriage => !mtmMatched.includes(carriage))
        let otherCarFull = metroConsists.find(consist => consist.includes(otherCars[0]))
        if (otherCarFull) {
          finalConsist = finalConsist.concat(otherCarFull)
        }
      } else {
        finalConsist = carriages
      }
    }

    if (finalConsist.length) {
      let tripData = {
        ...query,
        origin: trip.trueOrigin.slice(0, -16),
        destination: trip.trueDestination.slice(0, -16),
        departureTime: trip.trueDepartureTime,
        destinationArrivalTime: trip.trueDestinationArrivalTime,
        consist: finalConsist
      }

      await metroTrips.replaceDocument(query, tripData, {
        upsert: true
      })
    } else {
      return global.loggers.trackers.metro.warn('Encountered strange train', {
        consist,
        runID
      })
    }

    if (i < 5) {
      if (trip.type === 'timings' && new Date() - trip.updateTime < 5 * 60 * 1000) return

      await getStoppingPattern(database, ptvRunID, 'metro train', scheduledDepartureTime.toISOString())
    }
  })
}

async function requestTimings() {
  let stop = pickRandomStop()
  global.loggers.trackers.metro.info('requesting timings for', stop)

  try {
    await getDepartures(stop)
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to get metro trips this round, skipping', e)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  metroTrips = database.getCollection('metro trips')

  schedule([
    [0, 60, 1.2],
    [61, 299, 1.2],
    [300, 1079, 0.5],
    [1080, 1199, 0.3333],
    [1200, 1380, 0.5],
    [1381, 1440, 0.45]
  ], requestTimings, 'metro tracker', global.loggers.trackers.metro)
})
