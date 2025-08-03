import turf from '@turf/turf'

export function getFirstMatchingStop(dir0, dir1) {
  return dir0.find(dir0Stop => {
    return dir1.some(dir1Stop => dir0Stop === dir1Stop)
  })
}

export async function matchDirectionStops(stops, dir0, dir1) {
  let firstMatchingStop = getFirstMatchingStop(dir0.map(stop => stop.stopName), dir1.map(stop => stop.stopName))
  if (!firstMatchingStop) return
  let dir0Index = dir0.findIndex(stop => stop.stopName === firstMatchingStop)
  let dir1Index = dir1.findIndex(stop => stop.stopName === firstMatchingStop)

  let oppositeStops = {}

  let lastMatch = dir1Index
  for (let i = dir0Index + 1; i < dir0.length; i++) {
    let stopToMatch = dir0[i]
    let dir0StopData = await stops.findDocument({
      'bays.stopGTFSID': stopToMatch.stopGTFSID
    })

    // Match at most 3 stops into the future
    for (let j = lastMatch + 1; j < lastMatch + 4; j++) {
      let dir1Stop = dir1[j]
      if (dir1Stop.stopName === stopToMatch.stopName) {
        lastMatch = j
        break
      }

      let dir1StopData = await stops.findDocument({
        'bays.stopGTFSID': dir1Stop.stopGTFSID
      })

      let stopDistance = turf.distance(
        turf.center(dir0StopData.location),
        turf.center(dir1StopData.location)
      ) * 1000

      if (stopDistance < 200) {
        lastMatch = j
        oppositeStops[dir0StopData._id] = dir1StopData._id
        oppositeStops[dir1StopData._id] = dir0StopData._id
        break
      }
    }
  }

  await stops.bulkWrite(Object.keys(oppositeStops).map(stopID => ({
    updateOne: {
      filter: { _id: stops.createObjectID(stopID) },
      update: {
        $set: {
          oppositeStopID: oppositeStops[stopID]
        }
      }
    }
  })))
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