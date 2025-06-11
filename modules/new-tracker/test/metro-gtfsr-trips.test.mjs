import { expect } from 'chai'
import { MetroGTFSRTrip, ScheduledMetroGTFSRTrip, UnscheduledMetroGTFSRTrip } from '../GTFSRTrip.mjs'
import { getUpcomingTrips } from '../metro-gtfsr-trips.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import pkmStops from './sample-data/pkm-stops-db.json' with { type: 'json' }
import bbnStops from './sample-data/bbn-stops-db.json' with { type: 'json' }
import gtfsr_EPH from './sample-data/gtfsr-eph.json' with { type: 'json' }
import gtfsr_WIL from './sample-data/gtfsr-wil-noopday.json' with { type: 'json' }
import gtfsr_BBN from './sample-data/gtfsr-bbn-lab-amex.json' with { type: 'json' }

let clone = o => JSON.parse(JSON.stringify(o))

describe('The GTFSR Tracker module', () => {
  it('Should return the GTFSR data as a list of stop names, platforms, and departure times', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    await stops.createDocuments(clone(pkmStops))

    let tripData = await getUpcomingTrips(database, () => gtfsr_EPH)
    expect(tripData[0].operationDays).to.equal('20250606')
    expect(tripData[0].runID).to.equal('C036')
    expect(tripData[0].routeGTFSID).to.equal('2-PKM')
    expect(tripData[0].cancelled).to.be.false

    expect(tripData[0].stops[0]).to.deep.equal({
      stopName: 'East Pakenham Railway Station',
      platform: '1',
      scheduledDepartureTime: null,
      estimatedDepartureTime: new Date(1749159840 * 1000),
      cancelled: false
    })

    expect(tripData[0].stops[1]).to.deep.equal({
      stopName: 'Pakenham Railway Station',
      platform: null,
      scheduledDepartureTime: null,
      estimatedArrivalTime: new Date(1749159900 * 1000),
      estimatedDepartureTime: new Date(1749159960 * 1000),
      cancelled: false
    })
  })

  it('Should handle a live trip not having an operation day', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    await stops.createDocument({
      "stopName" : "South Kensington Railway Station",
      "bays" : [
        {
          "originalName" : "South Kensington Railway Station",
          "fullStopName" : "South Kensington Railway Station",
          "stopGTFSID" : "vic:rail:SKN",
          "location" : {
            "type" : "Point",
            "coordinates" : [
              144.92546901,
              -37.79953087
            ]
          },
          "stopNumber" : null,
          "mode" : "metro train",
          "suburb" : "Kensington",
          "services" : [
          ],
          "screenServices" : [
          ],
          "stopType" : "station",
          "parentStopGTFSID" : null
        },
        {
          "originalName" : "South Kensington Station",
          "fullStopName" : "South Kensington Railway Station",
          "stopGTFSID" : "15522",
          "location" : {
            "type" : "Point",
            "coordinates" : [
              144.92476672,
              -37.79946443
            ]
          },
          "stopNumber" : null,
          "mode" : "metro train",
          "suburb" : "Kensington",
          "services" : [ ],
          "screenServices" : [ ],
          "stopType" : "stop",
          "parentStopGTFSID" : "vic:rail:SKN",
          "platform" : "1"
        },
        {
          "originalName" : "South Kensington Station",
          "fullStopName" : "South Kensington Railway Station",
          "stopGTFSID" : "15523",
          "location" : {
            "type" : "Point",
            "coordinates" : [
              144.92492262,
              -37.79957532
            ]
          },
          "stopNumber" : null,
          "mode" : "metro train",
          "suburb" : "West Melbourne",
          "services" : [ ],
          "screenServices" : [ ],
          "stopType" : "stop",
          "parentStopGTFSID" : "vic:rail:SKN",
          "platform" : "2"
        }
      ]
    })

    let tripData = await getUpcomingTrips(database, () => gtfsr_WIL)
    expect(tripData[0].operationDays).to.equal('20250611')
    expect(tripData[0].runID).to.equal('7072')
    expect(tripData[0].routeGTFSID).to.equal('2-WIL')
    expect(tripData[0].cancelled).to.be.false

    expect(tripData[0].stops[0]).to.deep.equal({
      stopName: 'South Kensington Railway Station',
      platform: '1',
      scheduledDepartureTime: null,
      estimatedDepartureTime: new Date(1749598500 * 1000),
      cancelled: false
    })
  })

  it('When a trip is duplicated, take the original', async () => {
    let database = new LokiDatabaseConnection('test-db')
    let stops = await database.createCollection('stops')
    await stops.createDocument(clone(bbnStops))

    let tripData = await getUpcomingTrips(database, () => gtfsr_BBN)
    expect(tripData.length).to.equal(1)
    expect(tripData[0].operationDays).to.equal('20250611')
    expect(tripData[0].runID).to.equal('3920')
    expect(tripData[0].routeGTFSID).to.equal('2-LIL')
    expect(tripData[0].cancelled).to.be.false

    expect(tripData[0].stops[0]).to.deep.equal({
      stopName: 'Blackburn Railway Station',
      platform: '2',
      scheduledDepartureTime: null,
      estimatedDepartureTime: new Date(1749599100 * 1000),
      cancelled: true
    })

    expect(tripData[0].stops[1]).to.deep.equal({
      stopName: 'Laburnum Railway Station',
      platform: '1',
      scheduledDepartureTime: null,
      estimatedArrivalTime: new Date(1749599220 * 1000),
      estimatedDepartureTime: new Date(1749599220 * 1000),
      cancelled: true
    })

    expect(tripData[0].stops[2]).to.deep.equal({
      stopName: 'Box Hill Railway Station',
      platform: '2',
      scheduledDepartureTime: null,
      estimatedArrivalTime: new Date(1749599340 * 1000),
      estimatedDepartureTime: new Date(1749599400 * 1000),
      cancelled: false
    })
  })
})

describe('The GTFSRTrip class', () => {
  describe('The Scheduled trip class', () => {
    it('Should only accept trips in the form 02-PKM--52-T5-C078', async () => {
      expect(ScheduledMetroGTFSRTrip.canProcess({ trip_id: '02-PKM--52-T5-C078' })).to.be.true
      expect(ScheduledMetroGTFSRTrip.canProcess({ trip_id: '02-BEG--52-T5-3605' })).to.be.true
      expect(ScheduledMetroGTFSRTrip.canProcess({ trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6168_20250603' })).to.be.false
    })

    it('Should extract the TDN', async () => {
      expect(new ScheduledMetroGTFSRTrip({
        trip_id: '02-PKM--52-T5-C080',
        route_id: 'aus:vic:vic-02-PKM:',
        direction_id: 0,
        start_time: '14:23:00',
        start_date: '20250603',
        schedule_relationship: 0
      }).getTDN()).to.equal('C080')

      expect(new ScheduledMetroGTFSRTrip({
        trip_id: '02-FKN--52-T5-4418',
        route_id: 'aus:vic:vic-02-FKN:',
        direction_id: 0,
        start_time: '14:38:00',
        start_date: '20250603',
        schedule_relationship: 0
      }).getTDN()).to.equal('4418')
    })

    it('Should extract the schedule relationship type', async () => {
      expect(new ScheduledMetroGTFSRTrip({
        trip_id: '02-FKN--52-T5-4418',
        route_id: 'aus:vic:vic-02-FKN:',
        direction_id: 0,
        start_time: '14:38:00',
        start_date: '20250603',
        schedule_relationship: 0
      }).getScheduleRelationship()).to.equal(MetroGTFSRTrip.SR_SCHEDULED)
    })
  })

  describe('The Unscheduled trip class', () => {
    it('Should only accept trips in the form vic:02SUY:_:R:vpt._Sunbury_6168_20250603', () => {
      expect(UnscheduledMetroGTFSRTrip.canProcess({ trip_id: '02-PKM--52-T5-C078' })).to.be.false
      expect(UnscheduledMetroGTFSRTrip.canProcess({ trip_id: '02-BEG--52-T5-3605' })).to.be.false
      expect(UnscheduledMetroGTFSRTrip.canProcess({ trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6168_20250603' })).to.be.true
    })

    it('Should accept live trips without an operation day', () => {
      expect(UnscheduledMetroGTFSRTrip.canProcess({ trip_id: 'vic:02WIL:_:R:vpt._Williamstown_7072_' })).to.be.true
    })

    it('Should extract the TDN', async () => {
      expect(new UnscheduledMetroGTFSRTrip({
        trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6112_20250603',
        route_id: 'aus:vic:vic-02-SUY:',
        direction_id: 0,
        start_time: '15:37:00',
        start_date: '20250603',
        schedule_relationship: 1
      }).getTDN()).to.equal('6112')
    })

    it('Should extract the schedule relationship type', async () => {
      expect(new UnscheduledMetroGTFSRTrip({
        trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6112_20250603',
        route_id: 'aus:vic:vic-02-SUY:',
        direction_id: 0,
        start_time: '15:37:00',
        start_date: '20250603',
        schedule_relationship: 1
      }).getScheduleRelationship()).to.equal(MetroGTFSRTrip.SR_ADDED)
    })
  })

  it('Should automatically generate the correct parser', () => {
    expect(MetroGTFSRTrip.parse({
      trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6112_20250603',
      route_id: 'aus:vic:vic-02-SUY:',
      direction_id: 0,
      start_time: '15:37:00',
      start_date: '20250603',
      schedule_relationship: 1
    }).getTDN()).to.equal('6112')

    expect(MetroGTFSRTrip.parse({
      trip_id: '02-STY--52-T5-8514',
      route_id: 'aus:vic:vic-02-STY:',
      direction_id: 0,
      start_time: '15:29:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getTDN()).to.equal('8514')
    
    expect(MetroGTFSRTrip.parse({
      trip_id: '02-STY--52-T5-8514',
      route_id: 'aus:vic:vic-02-STY:',
      direction_id: 0,
      start_time: '15:29:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getRouteID()).to.equal('2-STY')
  })
})
