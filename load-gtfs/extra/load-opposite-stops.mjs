export function getFirstMatchingStop(dir0, dir1) {
  return dir0.find(dir0Stop => {
    return dir1.some(dir1Stop => dir0Stop === dir1Stop)
  })
}

export async function matchDirectionStops(dir0, dir1) {
  // let 
}

export async function matchOppositeStops(database) {
  let stops = await database.getCollection('gtfs-stops')
  let routes = await database.getCollection('gtfs-routes')

  let allRoutes = await routes.distinct('routeGTFSID')
  for (let routeGTFSID of allRoutes) {
    let routeData = await routes.findDocument({ routeGTFSID })
    if (routeData.directions.length !== 2) continue
    let dir0 = routeData.directions[0].stops
    let dir1 = routeData.directions[1].stops.slice(0)
    dir1.reverse()

    await matchDirectionStops(stops, dir0, dir1)
  }
}