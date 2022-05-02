const async = require('async')
const config = require('../../config')
const modules = require('../../modules')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const getStoppingPattern = require('../metro-trains/get-stopping-pattern')
const ptvAPI = require('../../ptv-api')
const scheduleIntervals = require('./schedule-intervals')

let database
let liveTimetables

async function requestTimings() {
  let racecourseRunIDs = (await ptvAPI(`/v3/runs/route/1482`)).runs.filter(run => {
    return parseInt(run.run_ref) >= 948000
  }).map(run => ({ ptvRunID: run.run_ref, runID: utils.getRunID(run.run_ref)}))

  let extraTrains = racecourseRunIDs.filter(train => train.runID[0] === 'R' && train.runID[1] !== '4' && train.runID[1] !== '8')

  await async.forEachSeries(extraTrains, async train => {
    await getStoppingPattern({
      ptvRunID: train.ptvRunID
    }, database)
    await utils.sleep(2000)
  })

  let timetables = await liveTimetables.findDocuments({
    mode: 'metro train',
    operationDays: utils.getYYYYMMDDNow(),
    runID: {
      $in: extraTrains.map(train => train.runID)
    }
  }).toArray()

  let sorted = timetables.sort((a, b) => a.stopTimings[0].departureTimeMinutes - b.stopTimings[0].departureTimeMinutes)

  let forming = {}
  let formedBy = {}

  for (let i = 0; i < sorted.length; i++) {
    let train = sorted[i]
    let trainDirection = train.direction
    let destinationStop = train.stopTimings.find(stop => stop.stopName === train.trueDestination)

    let possibleForming = sorted.slice(i + 1).find(possibleTrain => {
      let originStop = possibleTrain.stopTimings.find(stop => stop.stopName === possibleTrain.trueOrigin)

      return possibleTrain.direction !== trainDirection
        && possibleTrain.trueOrigin === train.trueDestination
        && originStop.platform === destinationStop.platform
        && originStop.departureTimeMinutes > destinationStop.arrivalTimeMinutes
    })

    if (possibleForming) {
      forming[train.runID] = possibleForming.runID
      formedBy[possibleForming.runID] = train.runID
    }
  }

  await async.forEach(sorted, async train => {
    let update = { forming: null, formedBy: null }
    if (forming[train.runID]) update.forming = forming[train.runID]
    if (formedBy[train.runID]) update.formedBy = formedBy[train.runID]

    if (update.forming || update.formedBy) {
      await liveTimetables.updateDocument({
        _id: train._id
      }, {
        $set: update
      })
    }
  })
}

if (modules.tracker && modules.tracker.metroRaceTrains) {
  database = new DatabaseConnection(config.databaseURL, config.databaseName)
  database.connect(async () => {
    liveTimetables = database.getCollection('live timetables')

    let shouldRun = scheduleIntervals([
      [300, 420, 1]
    ])

    if (shouldRun) await requestTimings()
    process.exit()
  })
} else process.exit()
