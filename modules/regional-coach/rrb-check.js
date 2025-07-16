const { getDayOfWeek } = require('../../utils.js')

let longDistanceCountryStops = [
  "Albury",
  "Ararat",
  "Avenel",
  "Bairnsdale",
  "Beaufort",
  "Benalla",
  "Birregurra",
  "Broadford",
  "Camperdown",
  "Chiltern",
  "Colac",
  "Dingee",
  "Echuca",
  "Euroa",
  "Kerang",
  "Mooroopna",
  "Murchison East",
  "Nagambie",
  "Pyramid",
  "Rochester",
  "Rosedale",
  "Sale",
  "Shepparton",
  "Springhurst",
  "Stratford",
  "Swan Hill",
  "Terang",
  "Violet Town",
  "Wangaratta",
  "Warrnambool",
  "Winchelsea",
  "Wodonga",
  "Sherwood Park",
  "Creswick",
  "Clunes",
  "Maryborough",
  "Talbot",
  "Epsom"
].map(x => x + ' Railway Station')

module.exports = async function checkRRB(trip, tripStart, db) {
  let timetables = db.getCollection('timetables')
  let { origin, destination, routeName } = trip
  let operationDay = await getDayOfWeek(tripStart)
  let originDepartureMinutes = trip.stopTimings[0].departureTimeMinutes

  if (origin === 'Southern Cross Coach Terminal/Spencer Street') {
    origin = 'Southern Cross Railway Station'
  }
  if (destination === 'Southern Cross Coach Terminal/Spencer Street') {
    destination = 'Southern Cross Railway Station'
  }

  let varianceAllowed = 3
  if (longDistanceCountryStops.includes(origin) || longDistanceCountryStops.includes(destination)) varianceAllowed = 20

  let destinationStopName = destination.split('/')[0]
  let originStopName = origin.split('/')[0]

  let nspDeparture = await timetables.findDocument({
    mode: 'regional train',
    operationDays: operationDay,
    $and: [{
      stopTimings: {
        $elemMatch: {
          stopName: originStopName,
          departureTimeMinutes: {
            $gte: originDepartureMinutes - varianceAllowed,
            $lte: originDepartureMinutes + 3
          }
        }
      },
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: destinationStopName,
          departureTimeMinutes: {
            $gte: originDepartureMinutes + 3
          }
        }
      },
    }]
  })

  let railwayStationCount = 0
  for (let stop of trip.stopTimings) {
    if (stop.stopName.includes('Railway Station')) railwayStationCount++
  }

  // A majority of stops are railway stations but no NSP departure matched
  if (!nspDeparture && railwayStationCount / trip.stopTimings.length > 0.8 && trip.stopTimings.length > 2) {
    let secondStop = trip.stopTimings[1].stopName.split('/')[0]

    nspDeparture = await timetables.findDocument({
      mode: 'regional train',
      operationDays: operationDay,
      $and: [{
        stopTimings: {
          $elemMatch: {
            stopName: originStopName,
            departureTimeMinutes: {
              $gte: originDepartureMinutes - 12,
              $lte: originDepartureMinutes + 10
            }
          }
        },
      }, {
        stopTimings: {
          $elemMatch: {
            stopName: secondStop,
            departureTimeMinutes: {
              $gte: originDepartureMinutes + 10
            }
          }
        },
      }]
    })
  }

  trip.isRailReplacementBus = !!nspDeparture
  if (nspDeparture) trip.shortRouteName = nspDeparture.routeName
}