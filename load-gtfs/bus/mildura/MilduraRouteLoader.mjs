import { RouteLoader } from '@transportme/load-ptv-gtfs'
import GTFSAgency from '@transportme/load-ptv-gtfs/lib/gtfs-parser/GTFSAgency.mjs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

const { TRANSIT_MODES } = GTFS_CONSTANTS

export default class MilduraRouteLoader extends RouteLoader {

  #cdcMildura

  constructor(database) {
    super('', '', TRANSIT_MODES.bus, database)
  }

  loadAgencies() {
    this.#cdcMildura = new GTFSAgency({
      id: '',
      name: 'CDC Mildura'
    })
  }

  getOperator(id) {
    return this.#cdcMildura
  }

}