import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../../config.json' with { type: 'json' }
import utils from '../../../utils.mjs'
import urls from '../../../urls.json' with { type: 'json' }
import VLineTripUpdater from '../../vline/trip-updater.mjs'

let database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await database.connect()
const tt = database.getCollection('live timetables')

let tripDatabase = new MongoDatabaseConnection(config.tripDatabaseURL, config.databaseName)
await tripDatabase.connect()

const tokP = await utils.request(urls.vlineToken)
const tok = tokP.match(/jwtToken = '([^']+)'/)[1]

async function getDeps(code, jt) {
  const wsurl = urls.wsapi.format(code, jt)
  const ws = new WebSocket(wsurl)
  return await new Promise(resolve => {
    ws.addEventListener('message', msg => {
      const data = JSON.parse(msg.data.slice(0, -1))
      if (data.type === 1) {
        const depData = JSON.parse(data.arguments[0])
        resolve(depData)
        ws.close()
      }
    })
    ws.addEventListener('open', () => {
      ws.send('{"protocol":"json","version":1}')
    })
  })
}

async function getStation(station, code) {
  const departures = await getDeps(code, tok)

  for (let dep of departures.departureServices.filter(z=>z.platformLabel=='Platform')) {
    const schDepTime = utils.now().startOf('day').add(utils.getMinutesPastMidnightFromHHMM(dep.departureTime), 'minutes')
    const trip = await tt.findDocument({
      mode: 'regional train',
      $and: [{
        stopTimings: {
          $elemMatch: {
            stopName: station + ' Railway Station',
            scheduledDepartureTime: {
              $in: [
                schDepTime.clone().toISOString(),
                schDepTime.clone().add(1, 'minute').toISOString(),
                schDepTime.clone().add(2, 'minute').toISOString(),
                schDepTime.clone().add(3, 'minute').toISOString(),
                schDepTime.clone().add(-1, 'minute').toISOString(),
                schDepTime.clone().add(-2, 'minute').toISOString(),
                schDepTime.clone().add(-3, 'minute').toISOString(),
              ]
            }
          }
        }
      }, {
        stopTimings: {
          $elemMatch: {
            stopName: dep.destination + ' Railway Station',
            departureTimeMinutes: {
              $gte: utils.getMinutesPastMidnightFromHHMM(dep.departureTime)
            }
          }
        }
      }]
    })

    if (!trip) continue
    const tripData = {
      operationDays: trip.operationDays,
      runID: trip.runID,
      routeGTFSID: trip.routeGTFSID,
      stops: [{
        stopName: station + ' Railway Station',
        platform: dep.platform || null,
      }]
    }

    await VLineTripUpdater.updateTrip(database, tripDatabase, tripData, {
      skipStopCancellation: true,
      dataSource: 'vline-secret-page',
      fullTrip: true
    })
  }
}

await getStation('Traralgon', 'TRN')
await getStation('Ballarat', 'BAT')
await getStation('Bacchus Marsh', 'BAH')

database.close()
process.exit(0)
