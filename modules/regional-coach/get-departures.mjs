import { getDepartures } from '../departures/get-departures.mjs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import destinationOverrides from '../../additional-data/coach-stops.mjs'
import utils from '../../utils.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

export default async function getCoachDepartures(stop, db, departureTime, { timeframe = 120 } = {}) {
  let departures = await getDepartures(stop, TRANSIT_MODES.regionalCoach, db, { departureTime, timeframe })
  
  for (let departure of departures) {
    departure.isRailReplacementBus = departure.trip.isRailReplacementBus || false

    let destination = destinationOverrides(departure.trip.stopTimings.slice(-1)[0])
    if (departure.trip.destination.includes(' Railway Station')) {
      destination = departure.trip.destination.split('/')[0]
    }

    let shortName = utils.getStopName(destination)
    if (!utils.isStreet(shortName)) destination = shortName

    departure.destination = destination
  }

  return departures
}