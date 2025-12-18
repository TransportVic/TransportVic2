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

  async generateFileContents(stream) {
    const dbRoutes = await this.#db.getCollection('routes')

    stream.write(`route_id,route_short_name,route_type\n`)
    await dbRoutes.batchQuery({}, 100, routes => {
      for (const route of routes) {
        stream.write(`"${route.routeGTFSID}","${route.routeNumber || route.routeName}","${this.#ROUTE_TYPE[route.mode]}"\n`)
      }
    })
  }

}