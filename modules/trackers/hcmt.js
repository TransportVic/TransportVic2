// Requires metro-trips

const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')
const ptvAPI = require('../../ptv-api')
const { getDayOfWeek } = require('../../public-holidays')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let liveTimetables

async function getDepartures() {
  let startOfDay = utils.now().startOf('day')
  let day = utils.getYYYYMMDD(startOfDay)

  let tripCount = await liveTimetables.countDocuments({
    operationDays: day,
    mode: 'metro train'
  })

  if (tripCount < 10) {
    global.loggers.trackers.metro.info('[HCMT]: No metro trips recorded yet, sleeping a bit')
    await utils.sleep(10 * 1000)
  }

  let pakenhamRunIDs = (await ptvAPI(`/v3/runs/route/11`)).runs.filter(run => {
    return parseInt(run.run_ref) >= 948000
  }).map(run => utils.getRunID(run.run_ref))
  let cranbourneRunIDs = (await ptvAPI(`/v3/runs/route/4`)).runs.filter(run => {
    return parseInt(run.run_ref) >= 948000
  }).map(run => utils.getRunID(run.run_ref))

  let allPTVRunIDs = pakenhamRunIDs.concat(cranbourneRunIDs)

  let allScheduledRunIDs = await liveTimetables.distinct('runID', {
    operationDays: day,
    mode: 'metro train',
    routeName: {
      $in: ['Cranbourne', 'Pakenham']
    }
  })

  // PTV Doesnt have it, likely to be HCMT
  let missingTrips = allScheduledRunIDs.filter(runID => !allPTVRunIDs.includes(runID))

  global.loggers.trackers.metro.info(`[HCMT]: Logged following trips as HCMT: ${missingTrips.join(', ')}. Total of ${missingTrips.length} trips.`)

  await liveTimetables.updateDocuments({
    operationDays: day,
    mode: 'metro train',
    runID: {
      $in: missingTrips
    }
  }, {
    $set: {
      vehicle: {
        size: '7',
        type: 'HCMT',
        consist: [],
      },
      h: true
    }
  })

  // Update any trips marked as HCMT but not missing as unknown vehicle
  await liveTimetables.updateDocuments({
    operationDays: day,
    mode: 'metro train',
    runID: {
      $not: {
        $in: missingTrips
      }
    },
    h: true
  }, {
    $set: {
      vehicle: null,
      h: false
    }
  })
}

async function requestTimings() {
  global.loggers.trackers.metro.info('Looking for hcmt trips')

  try {
    let departures = await getDepartures()
  } catch (e) {
    global.loggers.trackers.metro.err('Failed to find HCMT trips, skipping', e)
  }
}

database.connect(async () => {
  liveTimetables = database.getCollection('live timetables')

  schedule([
    [180, 240, 6], // Run it from 3am - 4am, taking into account website updating till ~3.30am
    [240, 360, 6],
    [360, 1199, 3],
    [1200, 1380, 4],
    [1380, 1439, 6]
  ], requestTimings, 'hcmt tracker', global.loggers.trackers.metro)
})
