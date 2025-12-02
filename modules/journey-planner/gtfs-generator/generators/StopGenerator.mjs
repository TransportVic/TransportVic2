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

  async generateFileContents(stream) {
    const dbStops = await this.#db.getCollection('stops')
    const baysSeen = new Set()

    stream.write(`stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,platform_code\n`)
    await dbStops.batchQuery({}, 100, stops => {
      for (const stop of stops) {
        for (const bay of stop.bays) {
          if (baysSeen.has(bay.stopGTFSID)) continue
          baysSeen.add(bay.stopGTFSID)
          stream.write(`"${bay.stopGTFSID}","${bay.fullStopName}","${bay.location.coordinates[1]}","${bay.location.coordinates[0]}","${this.#STOP_TYPE[bay.stopType]}","${bay.parentStopGTFSID || ''}","${bay.platform || ''}"\n`)
        }
      }
    })
  }

}