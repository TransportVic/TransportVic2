import Departures from '../departures/get-departures.mjs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import guessScheduledPlatforms from '../vline-old/guess-scheduled-platforms.mjs'
import getCoachDepartures from '../regional-coach/get-departures.mjs'
import utils from '../../utils.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

export class VLineDepartures extends Departures {

  static getLiveTimetableCutoff() {
    const now = utils.now()

    if (now.get('hours') < 3) return now.startOf('day').set('hours', 3)
    return now.startOf('day').add(1, 'day').set('hours', 3)
  }

  static async getDepartures(station, mode, db, options) {
    const departures = await super.getDepartures(station, mode, db, options)
    return departures.map(departure => ({
      ...departure,
      allStops: departure.allStops.map(stop => stop.slice(0, -16)),
      futureStops: departure.futureStops.map(stop => stop.slice(0, -16))
    }))
  }

}

export default async function getVLineDepartures(station, db, departureTime, { timeframe = 120 } = {}) {
  let departures = await VLineDepartures.getDepartures(station, TRANSIT_MODES.regionalTrain, db, { departureTime, timeframe })

  let coachStop = station.stopName === 'Southern Cross Railway Station' ? await db.getCollection('stops').findDocument({
    stopName: 'Southern Cross Coach Terminal/Spencer Street'
  }) : station
  let coachDepartures = await getCoachDepartures(coachStop, db, departureTime, { timeframe })

  for (let departure of departures) {
    let { trip, currentStop } = departure

    if (currentStop.platform) {
      departure.platform = currentStop.platform
    } else {
      departure.platform = (guessScheduledPlatforms(
        currentStop.stopName.slice(0, -16),
        trip.stopTimings[0].departureTimeMinutes,
        trip.routeName,
        trip.direction
      ) || '?') + '?'
    }

    departure.destination = departure.destination.slice(0, -16)
    departure.runID = departure.trip.runID
  }

  return [
    ...departures,
    ...coachDepartures.filter(departure => departure.isRailReplacementBus).map(coach => ({
      ...coach,
      destination: coach.destination === 'Southern Cross Coach Terminal' ? 'Southern Cross' :
        coach.destination === 'Adelaide City (SA)' ? coach.destination : coach.destination.slice(0, -16)
    }))
  ].sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
}