import { GTFSReaders, GTFSTypes, StopsLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import { closest, distance } from 'fastest-levenshtein'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'

import routeStops from '../../../additional-data/metro-data/metro-routes.json' with { type: 'json' }

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const suburbsVIC = JSON.parse(await fs.readFile(path.join(__dirname, '../../../transportvic-data/geospatial/suburb-boundaries/vic.geojson')))

const allStops = Object.values(routeStops).reduce((a,e) => a.concat(e), [])

export class MTMRailStop extends GTFSTypes.GTFSStop {

  constructor(data = { stopGTFSID, stopName, stopLat, stopLon, locationType, parentStopGTFSID }, suburbs, suburbHook) {
    super(data, suburbs, suburbHook)
    this.stopGTFSID = `RAIL_${this.stopGTFSID}`
  }

  requiresSuburb() {
    return true
  }

  getFullStopName() {
    let parts
    let stopName
    if ((parts = this.rawStopName.match(/^([\w \.]*?)_?(Up|Down)$/i)) || (parts = this.rawStopName.match(/^([\w \.]*?)(Up|Down)?[ _]?\(([\w ]+)\)/i))) {
      stopName = parts[1]
    } else {
      stopName = this.rawStopName.replace(' Station', '').trim()
    }

    let bestMatch = closest(stopName, allStops)

    if (bestMatch !== stopName) {
      let textDistance = distance(stopName, bestMatch)
      // if (textDistance > 4) return 'DISCARD'
      if (textDistance <= 4) stopName = bestMatch
    }

    return `${stopName} Railway Station`
  }

}

export class MTMRailStopsReader extends GTFSReaders.GTFSStopsReader {

  processEntity(data) {
    let stopData = {
      stopGTFSID: data.stop_id,
      stopName: data.stop_name,
      stopLat: data.stop_lat,
      stopLon: data.stop_lon,
      platform: data.platform_code,
      locationType: data.location_type,
      parentStopGTFSID: data.parent_station
    }

    return new MTMRailStop(stopData, this.getSuburbData(), this.getSuburbHook())
  }
}

export default class MTMRailStopLoader extends StopsLoader {

  constructor(stopsFile, database) {
    super(stopsFile, suburbsVIC, GTFS_CONSTANTS.TRANSIT_MODES.metroTrain, database)
  }

  getStopsDB(db) {
    return db.getCollection('stops')
  }

  createStopReader(stopsFile, suburbs, suburbHook) {
    return new MTMRailStopsReader(stopsFile, suburbs, suburbHook)
  }

  async loadStops() {
    await super.loadStops({
      processStop: stop => {
        if (stop.fullStopName === 'DISCARD') return null
        return stop
      }
    })
  }
}