const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')
const getStoppingPattern = require('../metro-trains/get-stopping-pattern')
const ptvAPI = require('../../ptv-api')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

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
}

database.connect(async () => {
  liveTimetables = database.getCollection('live timetables')

  schedule([
    [300, 420, 30] // 5 - 7am
  ], requestTimings, 'metro race trains', global.loggers.trackers.metro)
})
