const async = require('async')
const config = require('../../config')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const schedule = require('./scheduler')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

async function requestTimings() {
  let metroNotify = database.getCollection('metro notify')

  let data = JSON.parse(await utils.request(urls.metroNotify))

  let mergedAlerts = {}

  Object.keys(data)
  .filter(key => !isNaN(parseInt(key)))
  .map(key => data[key])
  .filter(routeData => routeData.alerts && routeData.alerts instanceof Array)
  .map(routeData => routeData.alerts)
  .reduce((a, e) => a.concat(e), [])
  .forEach(alert => {
    let routeName = data[alert.line_id].line_name
    if (alert.line_id == '94') routeName = 'Stony Point'

    if (!mergedAlerts[alert.alert_id]) {
      mergedAlerts[alert.alert_id] = {
        alertID: alert.alert_id,
        routeName: [routeName],
        fromDate: parseInt(alert.from_date),
        toDate: parseInt(alert.to_date),
        type: alert.alert_type,
        text: alert.alert_text.replace(/Plan your journey.*/, '').replace(/Visit .*? web.*/g, '').trim(),
        active: true
      }
    } else {
      mergedAlerts[alert.alert_id].routeName.push(routeName)
    }
  })

  let bulkOperations = []
  Object.values(mergedAlerts).forEach(alert => {
    bulkOperations.push({
      replaceOne: {
        filter: { alertID: alert.alertID },
        replacement: alert,
        upsert: true
      }
    })
  })

  let alertIDs = Object.keys(mergedAlerts)
  await metroNotify.updateDocuments({
    alertID: {
      $not: {
        $in: alertIDs
      }
    },
    active: true
  }, {
    $set: {
      active: false
    }
  })

  await metroNotify.bulkWrite(bulkOperations)
}

database.connect(async () => {
  schedule([
    [0, 1440, 1]
  ], requestTimings, 'metro notify', global.loggers.trackers.metroNotify)
})
