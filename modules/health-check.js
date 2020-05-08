const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')

const mtmHealthCheck = require('./health-check/metro')
const startVlineMailServer = require('./health-check/vline')

var refreshRate = 10
const database = new DatabaseConnection(config.databaseURL, config.databaseName)

// during peak an increased update freq of 10min is used - 24req during both peaks combined
// 4 hours peak time
function isPeak() {
  let minutes = utils.getMinutesPastMidnightNow()

  let isAMPeak = 360 <= minutes && minutes <= 510 // 0630 - 0830
  let isPMPeak = 1020 <= minutes && minutes <= 1140 // 1700 - 1900

  return isAMPeak || isPMPeak
}

// during night a reduced frequency of 20min is used - 24req during night time
// 8 hours night time
function isNight() {
  let minutes = utils.getMinutesPastMidnightNow()

  let isPast2130 = minutes > 1290 // past 2130
  let isBefore0530 = minutes < 330 // before 0530

  return isPast2130 || isBefore0530
}

// 4hr peak -> 24req
// 8hr night-> 24req
// 12hr left-> 48req
// total      96req per endpoint not account restarts
function updateRefreshRate() {
  if (isNight()) refreshRate = 20
  else if (isPeak()) refreshRate = 10
  else refreshRate = 15
}

if (!config.devMode) {
  database.connect(async (err) => {
    async function refreshCache() {
      try {
        mtmHealthCheck(database)
      } catch (e) {
        console.log('Failed to pass health check')
        console.err(e)
      } finally {
        updateRefreshRate()
        setTimeout(refreshCache, refreshRate * 60 * 1000)
      }
    }

    await refreshCache()
  })

  startVlineMailServer()
}
