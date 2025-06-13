import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import { PTVAPI, StubAPI } from '@transportme/ptv-api'
import { fetchTrips } from '../metro/metro-notify-trips.mjs'
import { getActiveSuspensions, getStationsOnRoute } from '../metro/metro-notify-suspensions.mjs'
import pkmRouteStops from './sample-data/pkm-route-stops.json' with { type: 'json' }
import pkmStopsDB from './sample-data/pkm-stops-db.json' with { type: 'json' }

let clone = o => JSON.parse(JSON.stringify(o))

describe('The MetroNotify trip tracker', () => {
  it('Should a list of routes with active suspensions', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let metroNotify = await database.createCollection('metro notify')

    await metroNotify.createDocument({
      alertID: "304c1e31d6",
      rawAlertID: "647538",
      routeName: [
        "Hurstbridge"
      ],
      fromDate: +(new Date() / 1000) - 60, // 1 min ago
      toDate: +(new Date() / 1000) + 60 * 5, // 5 min from now 
      type: "suspended",
      text: "<p>Buses replace trains between Eltham and Hurstbridge due to vandalism.</p>\n<ul>\n<li>Replacement buses have been ordered, however will take over 60 minutes to arrive</li>\n<li>A train service will operate between Flinders Street and Eltham, with delays to the service</li>\n<li>Allow extra travel time</li>\n</ul>\n<p>Check information displays and listen for announcements.</p>",
      active: true
    })

    await metroNotify.createDocument({
      alertID: "304c1e31d7",
      rawAlertID: "647539",
      routeName: [
        "Belgrave"
      ],
      fromDate: +(new Date() / 1000) - 60, // 1 min ago
      toDate: +(new Date() / 1000) + 60 * 5, // 5 min from now 
      type: "suspended",
      text: "<p>Buses replace trains between Eltham and Hurstbridge due to vandalism.</p>\n<ul>\n<li>Replacement buses have been ordered, however will take over 60 minutes to arrive</li>\n<li>A train service will operate between Flinders Street and Eltham, with delays to the service</li>\n<li>Allow extra travel time</li>\n</ul>\n<p>Check information displays and listen for announcements.</p>",
      active: false
    })

    expect(await getActiveSuspensions(database)).to.deep.equal(['Hurstbridge'])
  })

  it('Should return all stops on a given line but not CBD stops', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    let routes = await database.createCollection('routes')

    await stops.createDocuments(clone(pkmStopsDB))
    await routes.createDocument({
      "mode": "metro train",
      "routeName": "Pakenham",
      "cleanName": "pakenham",
      "routeNumber": null,
      "routeGTFSID": "2-PKM",
      "operators": [
        "Metro"
      ],
      "directions": pkmRouteStops,
      "codedName": "pakenham"
    })

    let pkmStops = await getStationsOnRoute(database, 'Pakenham')
    expect(pkmStops).to.include('South Yarra Railway Station')
    expect(pkmStops).to.not.include('Flinders Street Railway Station')
    expect(pkmStops).to.not.include('Richmond Railway Station')
  })
})