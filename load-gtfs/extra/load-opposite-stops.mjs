export async function matchOppositeStops(database) {
  let stops = await database.getCollection('gtfs-stops')
  let routes = await database.getCollection('gtfs-routes')

  let allRoutes = await routes.distinct('routeGTFSID')
  for (let route of allRoutes) {
    console.log(route)
  }
}