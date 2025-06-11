import { PTVAPI, MetroSiteAPIInterface } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }

export async function fetchNotifyAlerts(ptvAPI, db) {
  let metroNotify = await db.getCollection('metro notify')
  let alerts = await ptvAPI.metroSite.getNotifyData()

  let alertData = alerts.map(alert => ({
    alertID: alert.id,
    rawAlertID: alert.rawID,
    routeName: alert.lineNames,
    fromDate: +alert.startTime / 1000,
    toDate: +alert.endTime / 1000,
    type: alert.type,
    text: alert.html,
    ...(alert.runID ? { runID: alert.runID } : {}),
    active: true
  }))

  let bulkReplace = alertData.map(alert => ({
    replaceOne: {
      filter: { alertID: alert.alertID },
      replacement: alert,
      upsert: true
    }
  }))

  await metroNotify.bulkWrite(bulkReplace)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  await fetchNotifyAlerts(ptvAPI, mongoDB)

  process.exit(0)
}