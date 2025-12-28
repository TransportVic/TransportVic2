import { fileURLToPath } from 'url'

import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import _ from '../../init-loggers.mjs'
import { fetchGTFSRFleet } from './metro/metro-gtfsr-fleet.mjs'
import { fetchNotifyAlerts } from './metro/metro-notify.mjs'
import { MetroSiteAPIInterface, PTVAPI, PTVAPIInterface } from '@transportme/ptv-api'
import { fetchTrips as fetchPTVDepartures } from './metro/metro-ptv-departures.mjs'
import { fetchTrips as fetchPTVTrips } from './metro/metro-ptv-trips.mjs'
import { fetchNotifyTrips } from './metro/metro-notify-trips.mjs'
import { fetchCBDTrips } from './metro/metro-cbd-ptv-departures.mjs'
import { fetchNotifySuspensions } from './metro/metro-notify-suspensions.mjs'
import { fetchOutdatedTrips } from './metro/metro-outdated-trips.mjs'
import { fetchGTFSRTrips } from './metro/metro-gtfsr-trips.mjs'
import { updateRelatedTrips } from './metro/check-new-updates.mjs'
import fs from 'fs/promises'
import { writeUpdatedTrips } from './metro.mjs'

if (await fs.realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect()

  let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
  await tripDatabase.connect()

  let ptvAPI = new PTVAPI(new PTVAPIInterface(config.ptvKeys[0].devID, config.ptvKeys[0].key))
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  let existingTrips = {}
  try { await fetchGTFSRTrips(database, tripDatabase, existingTrips) } catch(e) { console.error(e) }
  try { await fetchGTFSRFleet(database, tripDatabase, existingTrips) } catch(e) { console.error(e) }
  try { await fetchNotifyAlerts(database, ptvAPI) } catch(e) { console.error(e) }

  try {
    let updatedTrips = await fetchPTVDepartures(database, tripDatabase, ptvAPI, { existingTrips })
    global.loggers.trackers.metro.log('> PTV Departures: Updating TDNs: ' + updatedTrips.map(trip => trip.runID).join(', '))
  } catch (e) { console.error(e) }

  try { await fetchPTVTrips(database, tripDatabase, ptvAPI, existingTrips) } catch(e) { console.error(e) }
  try { await fetchNotifyTrips(database, tripDatabase, ptvAPI, existingTrips) } catch(e) { console.error(e) }
  try { await fetchCBDTrips(database, tripDatabase, ptvAPI, existingTrips) } catch(e) { console.error(e) }
  try { await fetchNotifySuspensions(database, tripDatabase, ptvAPI, existingTrips) } catch(e) { console.error(e) }
  try { await fetchOutdatedTrips(database, tripDatabase, ptvAPI, existingTrips) } catch(e) { console.error(e) }

  try { await writeUpdatedTrips(database, tripDatabase, Object.values(existingTrips)) } catch(e) { console.error(e) }

  try { await updateRelatedTrips(database, tripDatabase, Object.values(existingTrips), ptvAPI) } catch(e) { console.error(e) }

  process.exit(0)
}