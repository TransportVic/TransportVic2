import { ShapeLoader } from '@transportme/load-ptv-gtfs'

export default class MTMRailShapeLoader extends ShapeLoader {

  constructor(shapeFile, database) {
    super(shapeFile, database)
  }

  getRoutesDB(db) {
    return db.getCollection('routes')
  }

}