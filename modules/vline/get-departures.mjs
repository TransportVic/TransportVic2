import { getDepartures } from '../departures/get-departures.js'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import guessScheduledPlatforms from '../vline-old/guess-scheduled-platforms.js'
import getCoachDepartures from '../regional-coach/get-departures.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

export default async function getVLineDepartures(station, db, departureTime, { timeframe = 120 } = {}) {
  let departures = await getDepartures(station, TRANSIT_MODES.regionalTrain, db, { departureTime, timeframe })

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
  }

  return [
    ...departures,
    ...coachDepartures.filter(departure => departure.isRailReplacementBus).map(coach => ({
      ...coach,
      destination: coach.destination === 'Southern Cross Coach Terminal' ? 'Southern Cross' : coach.destination.slice(0, -16)
    }))
  ].sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
}