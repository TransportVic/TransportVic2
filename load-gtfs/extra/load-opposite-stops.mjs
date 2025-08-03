import turf from '@turf/turf'
import { MongoDatabaseConnection } from '@transportme/database'
import path from 'path'
import url from 'url'
import fs from 'fs/promises'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  let stopDistances = {}

  let lastMatch = dir1Index
  for (let i = dir0Index + 1; i < dir0.length; i++) {
    let stopToMatch = dir0[i]
    let dir0StopData = await stops.findDocument({
      'bays.stopGTFSID': stopToMatch.stopGTFSID
    }, { textQuery: 0 })

    let smallestDistance = Infinity
    let bestMatch = null

    let matchIndex = -1
    // Match at most 20 stops into the future, and at most 4 more stops once a match has been found
    for (let j = lastMatch + 1; j < Math.min(lastMatch + 21, dir1.length) && (matchIndex === -1 || j < matchIndex + 4); j++) {
      let dir1Stop = dir1[j]
      if (dir1Stop.stopName === stopToMatch.stopName) {
        lastMatch = j
        break
      }

      let dir1StopData = await stops.findDocument({
        'bays.stopGTFSID': dir1Stop.stopGTFSID
      }, { textQuery: 0 })

      let stopDistance = turf.distance(
        turf.center(dir0StopData.location),
        turf.center(dir1StopData.location)
      ) * 1000

      if (stopDistance < 200 && stopDistance < smallestDistance) {
        lastMatch = (matchIndex = j)
        bestMatch = dir1StopData
      }
    }

    if (bestMatch) {
      let existingDistance = stopDistances[dir0StopData._id] || stopDistances[bestMatch._id] || Infinity

      // Found a better match
      if (smallestDistance < existingDistance || existingDistance === Infinity) {
        if (oppositeStops[dir0StopData._id]) oppositeStops[oppositeStops[dir0StopData._id]] = null
        if (oppositeStops[bestMatch._id]) oppositeStops[oppositeStops[bestMatch._id]] = null

        oppositeStops[dir0StopData._id] = bestMatch._id
        oppositeStops[bestMatch._id] = dir0StopData._id
      }
    }
  }

  let bulkWrite = Object.keys(oppositeStops).map(stopID => ({
    updateOne: {
      filter: { _id: stops.createObjectID(stopID) },
      update: {
        $set: {
          oppositeStopID: oppositeStops[stopID]
        }
      }
    }
  }))

  if (bulkWrite.length) await stops.bulkWrite(bulkWrite)
}

export async function matchOppositeStops(database) {
  let stops = await database.getCollection('gtfs-stops')
  let routes = await database.getCollection('gtfs-routes')

  let allRoutes = await routes.distinct('routeGTFSID', {
    routeGTFSID: /^([3456]|11)-/
  })

  for (let routeGTFSID of allRoutes) {
    let routeData = await routes.findDocument({ routeGTFSID })
    if (routeData.directions.length !== 2) continue
    let dir0 = routeData.directions[0].stops
    let dir1 = routeData.directions[1].stops.slice(0)
    dir1.reverse()

    await matchDirectionStops(stops, dir0, dir1)
  }
}

if (process.argv[1] === __filename) {
  const config = JSON.parse(await fs.readFile(path.join(__dirname, '../../config.json')))
  const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await database.connect({})
  
  console.log('Merging opposite stops')
  await matchOppositeStops(database)
  console.log('Done merging opposite stops')
  process.exit(0)
}