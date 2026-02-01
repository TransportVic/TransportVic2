import { getDayOfWeek } from '../../public-holidays.mjs'
import utils from '../../utils.mjs'

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

let outstationOriginStops = [
  'Pakenham',
  'Craigieburn',
  'Sunbury'
].map(x => x + ' Railway Station')

export default async function checkRRB(trip, tripOperationDay, timetables) {
  let { origin, destination, routeName } = trip
  let operationDay = await utils.getDayOfWeek(utils.parseDate(tripOperationDay))
  let originDepartureMinutes = trip.stopTimings[0].departureTimeMinutes

  if (origin === 'Southern Cross Coach Terminal/Spencer Street') {
    origin = 'Southern Cross Railway Station'
  }
  if (destination === 'Southern Cross Coach Terminal/Spencer Street') {
    destination = 'Southern Cross Railway Station'
  }

  let toleranceAllowed = 3
  if (longDistanceCountryStops.includes(origin) || longDistanceCountryStops.includes(destination)) toleranceAllowed = 20

  let destinationStopName = destination.split('/')[0]
  let originStopName = origin.split('/')[0]
  let isLongDistanceCoach = longDistanceCountryStops.includes(originStopName) || longDistanceCountryStops.includes(destinationStopName)

  let nspDeparture = await timetables.findDocument({
    mode: 'regional train',
    operationDays: operationDay,
    $and: [{
      stopTimings: {
        $elemMatch: {
          stopName: originStopName,
          departureTimeMinutes: {
            $gte: originDepartureMinutes - toleranceAllowed,
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

  if (nspDeparture) return nspDeparture

  let railwayStationCount = 0
  for (let stop of trip.stopTimings) {
    if (stop.stopName.includes('Railway Station')) railwayStationCount++
  }

  // A majority of stops are railway stations but no NSP departure matched
  // Check the inverse - discard a trip that does not match this rule
  if (!(railwayStationCount / trip.stopTimings.length > 0.8 && trip.stopTimings.length > 2)) return

  let secondStop = trip.stopTimings[1].stopName.split('/')[0]
  toleranceAllowed = isLongDistanceCoach ? 20 : 14

  let earlyTolerance = toleranceAllowed
  let lateTolerance = toleranceAllowed

  if (outstationOriginStops.includes(originStopName) && isLongDistanceCoach) {
    lateTolerance = 35
  }

  nspDeparture = await timetables.findDocument({
    mode: 'regional train',
    operationDays: operationDay,
    $and: [{
      stopTimings: {
        $elemMatch: {
          stopName: originStopName,
          departureTimeMinutes: {
            $gte: originDepartureMinutes - lateTolerance,
            $lte: originDepartureMinutes + earlyTolerance
          }
        }
      },
    }, {
      stopTimings: {
        $elemMatch: {
          stopName: secondStop,
          departureTimeMinutes: {
            $gte: originDepartureMinutes - lateTolerance
          }
        }
      },
    }]
  })

  if (nspDeparture) return nspDeparture
}