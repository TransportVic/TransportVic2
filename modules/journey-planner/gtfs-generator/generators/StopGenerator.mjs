import Generator from './Generator.mjs';

export default class StopGenerator extends Generator {

  #STOP_TYPE = {
    'stop': 0,
    'station': 1,
    'entrance': 2,
    'generic': 3,
    'boarding': 4
  }

  #db

  constructor(db) {
    super(db)
    this.#db = db
  }

  async generateFileContents() {
    const dbStops = await this.#db.getCollection('stops')
    const stops = await dbStops.findDocuments({}).toArray()
    const baysSeen = new Set()

    return [
      `stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,platform_code`,
      ...stops.flatMap(stop => stop.bays.map(bay => !(!baysSeen.has(bay.stopGTFSID) && (baysSeen.add(bay.stopGTFSID) || true)) ? null :
        `"${bay.stopGTFSID}","${bay.fullStopName}","${bay.location.coordinates[1]}","${bay.location.coordinates[0]}","${this.#STOP_TYPE[bay.stopType]}","${bay.parentStopGTFSID || ''}","${bay.platform || ''}"`
      )).filter(Boolean)
    ].join('\n')
  }

}