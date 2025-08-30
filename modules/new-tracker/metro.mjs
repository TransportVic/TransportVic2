import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import { fetchGTFSRFleet } from './metro/metro-gtfsr-fleet.mjs'
import { fetchNotifyAlerts } from './metro/metro-notify.mjs'
import { fetchMetroSiteDepartures } from './metro/metro-trips-departures.mjs'
import { MetroSiteAPIInterface, PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips as fetchPTVDepartures } from './metro/metro-ptv-departures.mjs'
import { fetchTrips as fetchPTVTrips } from './metro/metro-ptv-trips.mjs'
import { fetchNotifyTrips } from './metro/metro-notify-trips.mjs'
import { fetchCBDTrips } from './metro/metro-cbd-ptv-departures.mjs'
import { fetchNotifySuspensions } from './metro/metro-notify-suspensions.mjs'
import { fetchOutdatedTrips } from './metro/metro-outdated-trips.mjs'
import { fetchGTFSRTrips } from './metro/metro-gtfsr-trips.mjs'
import { updateRelatedTrips } from './metro/check-new-updates.mjs'
import utils from '../../utils.js'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await utils.setEnv()

  let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  // await fetchGTFSRTrips(mongoDB)
  await fetchGTFSRFleet(mongoDB)
  await fetchNotifyAlerts(mongoDB, ptvAPI)
  await fetchMetroSiteDepartures(mongoDB, ptvAPI)

  let updatedTrips = await fetchPTVDepartures(mongoDB, ptvAPI)
  global.loggers.trackers.metro.log('> PTV Departures: Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))
  await updateRelatedTrips(mongoDB, updatedTrips, ptvAPI)

  await fetchPTVTrips(mongoDB, ptvAPI)
  await fetchNotifyTrips(mongoDB, ptvAPI)
  await fetchCBDTrips(mongoDB, ptvAPI)
  await fetchNotifySuspensions(mongoDB, ptvAPI)
  await fetchOutdatedTrips(mongoDB, ptvAPI)

  process.exit(0)
}