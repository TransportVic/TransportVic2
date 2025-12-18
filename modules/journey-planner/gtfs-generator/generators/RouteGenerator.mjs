import Generator from './Generator.mjs'

export default class RouteGenerator extends Generator {

  #ROUTE_TYPE = {
    'regional train': '2',
    'metro train': '1',
    'tram': '0',
    'bus': '3',
    'regional coach': '3'
  }

  #db

  constructor(db) {
    super(db)
    this.#db = db
  }

  async generateFileContents(routeStream, shapeStream) {
    const dbRoutes = await this.#db.getCollection('routes')

    routeStream.write(`route_id,route_short_name,route_type\n`)
    shapeStream.write(`shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n`)

    await dbRoutes.batchQuery({}, 100, routes => {
      for (const route of routes) {
        routeStream.write(`"${route.routeGTFSID}","${route.routeNumber || route.routeName}","${this.#ROUTE_TYPE[route.mode]}"\n`)
        for (const shape of route.routePath) {
          const shapeID = shape.fullGTFSIDs[0]
          shape.path.coordinates.forEach((coord, i) => {
            shapeStream.write(`"${shapeID}","${coord[1]}","${coord[0]}","${i}"\n`)
          })
        }
      }
    })
  }

}