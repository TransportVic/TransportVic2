import stops from './stops.json' with { type: 'json' }
import routes from './routes.json' with { type: 'json' }
import tripData from './trips.json' with { type: 'json' }
import utils from '../../utils.mjs'

const search = 'Huntingdale Railway Station'
const searchMode = 'metro train'
const departureTime = utils.now()

const stop = stops.find(stop => stop.name.includes(search))
if (!stop) {
  console.log('Could not find', search)
  process.exit(0)
}

const servesStop = (trip, stopID) => trip.stopTimings.some(stop => stop.stopID === stopID)

const startDate = utils.parseDate(tripData.startDate)
const tripDate = departureTime.clone().startOf('day')
const day = departureTime.diff(startDate, 'days')
const departureCutoffTime = departureTime.clone().add(90, 'minutes')

const relevantTrips = tripData.trips.filter(trip => trip.operationDays.includes(day) && trip.mode === searchMode)
const tripIDsAtStop = {}

const departuresFromStop = relevantTrips.filter(trip => {
  if (trip.refTrip && tripIDsAtStop[trip.refTrip]) return true
  else if (trip.refTrip) {
    const baseTrip = tripData.trips[trip.refTrip - 1]
    tripIDsAtStop[trip.tripID] = servesStop(baseTrip, stop.stopID)
    return tripIDsAtStop[trip.tripID]
  } else {
    return servesStop(trip, stop.stopID)
  }
}).map(trip => {
  const tripToUse = trip.refTrip ? tripData.trips[trip.refTrip - 1] : trip
  const stopData = tripToUse.stopTimings.find(tripStop => tripStop.stopID === stop.stopID)
  const routeData = routes[trip.routeID - 1]
  const lastStop = tripToUse.stopTimings[tripToUse.stopTimings.length - 1]

  return {
    trip,
    stopData,
    destination: stops[lastStop.stopID - 1].name,
    routeNumber: routeData.number,
    routeName: routeData.name,
    departureMoment: tripDate.clone().add(trip.start + stopData.dep, 'minutes')
  }
}).filter(trip => {
  return departureTime <= trip.departureMoment && trip.departureMoment <= departureCutoffTime
}).sort((a, b) => a.departureMoment - b.departureMoment)

console.log(departuresFromStop)