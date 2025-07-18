import { GetPlatformServicesAPI } from '@transportme/ptv-api';
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils';

export async function getPlatformUpdates(operationDay, database, ptvAPI) {
  let stops = await database.getCollection('stops')
  let sss = await stops.findDocument({ stopName: 'Southern Cross Railway Station' })
  let vlineBay = sss.bays.find(bay => bay.mode === GTFS_CONSTANTS.TRANSIT_MODES.regionalTrain && bay.stopType === 'station')
  let departures = await ptvAPI.vline.getDepartures(vlineBay.vnetStationName, GetPlatformServicesAPI.UP, 30)
}