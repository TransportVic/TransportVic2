const config = require('../../config.json')
const DatabaseConnection = require('../../database/DatabaseConnection')
const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const stopNameModifier = require('../../additional-data/stop-name-modifier')
const stops = require('../../additional-data/bus-tracker/ptv-stops')
const async = require('async')
const schedule = require('./scheduler')
const gtfsGroups = require('../gtfs-id-groups')
const departureUtils = require('../utils/get-bus-timetables')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let dbStops, busTrips

function pickRandomStops() {
  let size = Math.round(stops.length / 2)
  return utils.shuffle(stops).slice(0, size)
}

async function requestTimings() {
  let stops = pickRandomStops()

  try {
    let ptvKey = await ptvAPI.getPTVKey()

    await async.forEachOf(stops, async (stop, i) => {
      let dbStop = await dbStops.findDocument({
        'bays.stopGTFSID': stop.gtfs
      })
      let allGTFSIDs = dbStop.bays.map(bay => bay.stopGTFSID)

      global.loggers.trackers.bus.info('requesting timings off PTV for', stop)

      setTimeout(async () => {
        let time = utils.now().toISOString()
        let timestamp = +new Date()

        let data = JSON.parse(await utils.request(
          `https://www.ptv.vic.gov.au/lithe/stop-services?stop_id=${stop.ptv}&mode_id=2&date=${time}&max_results=6&look_backwards=false&include_cancelled=true&__tok=${ptvKey}`
        ))

        await async.forEach(data.departures, async departure => {
          if (departure.run.vehicle_descriptor) {
            let scheduledDepartureTime = utils.parseTime(departure.scheduled_departure_utc)
            let routeNumber = departure.route.short_label
            let routeGTFSID = '4-' + routeNumber
            let smartrakID = parseInt(departure.run.vehicle_descriptor.id)

            let routeGTFSIDQuery = routeGTFSID, matchingGroup
            if (matchingGroup = gtfsGroups.find(g => g.includes(routeGTFSID))) {
              routeGTFSIDQuery = { $in: matchingGroup }
            }

            let destination = stopNameModifier(utils.adjustStopName(departure.run.destination_name.trim()))
            let trip = await departureUtils.getDeparture(database, allGTFSIDs, scheduledDepartureTime, destination, 'bus', routeGTFSIDQuery)

            if (trip) {
              let firstStop = trip.stopTimings[0]
              let currentStop = trip.stopTimings.find(stop => allGTFSIDs.includes(stop.stopGTFSID))
              let minutesDiff = currentStop.departureTimeMinutes - firstStop.departureTimeMinutes
              let originDepartureTime = scheduledDepartureTime.clone().add(-minutesDiff, 'minutes')
              let date = utils.getYYYYMMDD(originDepartureTime)

              let { origin, destination, departureTime, destinationArrivalTime } = trip

              let data = {
                date,
                timestamp,
                routeGTFSID: trip.routeGTFSID,
                smartrakID,
                routeNumber,
                origin, destination, departureTime, destinationArrivalTime
              }

              await busTrips.replaceDocument({
                date, routeGTFSID, origin, destination, departureTime, destinationArrivalTime
              }, data, {
                upsert: true
              })
            }
          }
        })
      }, i * 5000)
    })
  } catch (e) {
    global.loggers.trackers.bus.err('Failed to get bus trips this round', e)
  }
}

database.connect(async () => {
  dbStops = database.getCollection('stops')
  busTrips = database.getCollection('bus trips')
  schedule([
    [300, 1260, 4],
    [1261, 1440, 5]
  ], requestTimings, 'bus tracker', global.loggers.trackers.bus)
})
