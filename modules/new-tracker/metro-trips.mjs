import { PTVAPI, MetroSiteAPIInterface } from '@transportme/ptv-api'
import { fileURLToPath } from 'url'
import utils from '../../utils.js'

export async function getUpcomingTrips(ptvAPI, lines) {
  let trips = await ptvAPI.metroSite.getOperationalTimetable(lines)
  let today = utils.now().startOf('day')

  return trips.filter(trip => trip.operationalDateMoment >= today)
}

export async function fetchTrips(ptvAPI, db, lines=Object.values(ptvAPI.metroSite.lines)) {
  let relevantTrips = await getUpcomingTrips(ptvAPI, lines)
  let liveTimetables = db.getCollection('live timetables')

  for (let trip of relevantTrips) {
    let tripData = await liveTimetables.findDocument({
      mode: 'metro train',
      runID: trip.tdn,
      operationDays: trip.operationalDate
    })
    console.log(tripData)
  }
  console.log(relevantTrips)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let ptvAPI = new PTVAPI()
  ptvAPI.addMetroSite(new MetroSiteAPIInterface())

  await fetchTrips(ptvAPI, null, ptvAPI.metroSite.lines.STONY_POINT)
}