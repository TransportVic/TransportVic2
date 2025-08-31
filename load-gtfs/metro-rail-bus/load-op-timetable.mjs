import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.js'
import { convertToLive } from '../../modules/departures/sch-to-live.js'
import routeGroups from './route-groups.json' with { type: 'json' }

const routeGroupings = Object.keys(routeGroups).reduce((acc, e) => ({
  ...acc,
  [routeGroups[e]]: acc[routeGroups[e]] ? acc[routeGroups[e]].concat(e) : [e]
}), {})

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let gtfsTimetables = mongoDB.getCollection('gtfs timetables')
let liveTimetables = mongoDB.getCollection('live timetables')

async function loadOperationalTT(operationDay) {
  let opDayFormat = utils.getYYYYMMDD(operationDay)
  let rawActiveTrips = await gtfsTimetables.findDocuments({
    mode: 'metro train',
    operationDays: opDayFormat,
    routeGTFSID: '2-RRB'
  }).toArray()

  let activeTrips = rawActiveTrips.map(trip => convertToLive(trip, operationDay))

  for (let trip of activeTrips) {
    trip.operationDays = opDayFormat
    delete trip._id
  }

  // Delete all RRB data and use this only if there is actually data
  // Also means that if MTM data drops out but PTV data is still there we don't accidentally delete it
  // Note: Group into line groups as we sometimes have data programmed in on some lines but not others
  let tripGroups = Object.values(routeGroups).reduce((acc, grp) => ({
    ...acc,
    [grp]: []
  }), {})

  for (let trip of activeTrips) {
    tripGroups[routeGroups[trip.routeName]].push(trip)
  }

  for (let group of Object.keys(tripGroups)) {
    let trips = tripGroups[group]
    if (!trips.length) continue

    let hasRealtimeData = await liveTimetables.distinct('tripID', {
      mode: 'metro train',
      operationDays: opDayFormat,
      isRailReplacementBus: true,
      stopTimings: {
        $elemMatch: {
          estimatedDepartureTime: {
            $ne: null
          }
        }
      }
    })

    let replacementTrips = trips.filter(trip => !hasRealtimeData.includes(trip.tripID))
    let bulkWrite = replacementTrips.map(trip => ({
      replaceOne: {
        filter: {
          mode: 'metro train',
          operationDays: opDayFormat,
          tripID: trip.tripID
        },
        replacement: trip,
        upsert: true
      }
    }))

    await liveTimetables.deleteDocuments({
      mode: 'metro train',
      operationDays: opDayFormat,
      isRailReplacementBus: true,
      routeGTFSID: {
        $ne: '2-RRB'
      },
      routeName: {
        $in: routeGroupings[group]
      }
    })
    await liveTimetables.bulkWrite(bulkWrite)
  }
}

await loadOperationalTT(utils.now())
await loadOperationalTT(utils.now().add(1, 'day'))

await mongoDB.close()