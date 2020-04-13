const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')

const mtmHealthCheck = require('./health-check/metro')

var refreshRate = 10

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function watchVLineDisruptions(db) {
  let data = await utils.request(urls.vlineDisruptions)
  let feed = await rssParser.parseString(data)
  let items = feed.items.filter(item => item.title !== '')
  await async.forEach(items, async item => {
    let text = item.contentSnippet
    if (text.includes('will not run') || text.includes('has been cancelled')) {
      let service = text.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (:?to|-) ([\w ]*?) service (:?will not run|has been cancelled) /)
      let departureTime, origin, destination, isCoach
      let matches = []

      if (!service) {
        if (text.match(/services (:?will not run|has been cancelled)/)) {
          let services = text.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (:?to|-) ([\w ]*?) /g)
          services.forEach(service => {
            let parts = service.match(/(\d{1,2}:\d{1,2}) ([\w ]*?) (:?to|-) ([\w ]*?) /)
            departureTime = parts[1]
            origin = parts[2] + ' Railway Station'
            destination = parts[4] + ' Railway Station'
            isCoach = text.includes('coaches') && text.includes('replace')
            matches.push({departureTime, origin, destination, isCoach})
          })
        }
      } else {
        departureTime = service[1]
        origin = service[2] + ' Railway Station'
        destination = service[4] + ' Railway Station'
        isCoach = text.includes('replacement coaches')
        matches.push({departureTime, origin, destination, isCoach})
      }

      let operationDay = utils.getYYYYMMDDNow()

      await async.forEach(matches, async match => {
        let {departureTime, origin, destination, isCoach} = match

        let query = {
          departureTime, origin, destination,
          mode: 'regional train',
          operationDays: operationDay
        }

        await setServiceAsCancelled(db, query, operationDay, isCoach)
      })
    }
  })
}

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
}
