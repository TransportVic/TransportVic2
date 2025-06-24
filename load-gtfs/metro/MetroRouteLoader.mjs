import { RouteLoader } from '@transportme/load-ptv-gtfs'
import GTFSAgency from '@transportme/load-ptv-gtfs/lib/gtfs-parser/GTFSAgency.mjs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

const { TRANSIT_MODES } = GTFS_CONSTANTS

export default class MetroRouteLoader extends RouteLoader {

  #metro

  constructor(database) {
    super('', '', TRANSIT_MODES.metroTrain, database)
  }

  async loadAgencies() {
    this.#metro = new GTFSAgency({
      id: '3',
      name: 'Metro Trains Melbourne'
    })
  }

  getOperator(id) {
    return this.#metro
  }

}