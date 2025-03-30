import { PTVAPI, MetroSiteAPIInterface } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'

export async function getUpcomingTrips(ptvAPI) {
  let trips = await ptvAPI.metroSite.getOperationalTimetable(ptvAPI.metroSite.lines.STONY_POINT)
  let today = utils.now().startOf('day')

  return trips.filter(trip => trip.operationalDateMoment >= today)
}

export async function fetchTrips(api) {
  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(api)

  let relevantTrips = await getUpcomingTrips(ptvAPI)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await fetchTrips(new MetroSiteAPIInterface())
}