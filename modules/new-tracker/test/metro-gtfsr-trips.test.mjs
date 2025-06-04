import { expect } from 'chai'
import { MetroGTFSRTrip, ScheduledMetroGTFSRTrip, UnscheduledMetroGTFSRTrip } from '../GTFSRTrip.mjs'

let clone = o => JSON.parse(JSON.stringify(o))

function createAPI() {
  let stubAPI = new StubAPI()
  stubAPI.setResponses([ stubSTYOpData ])
  stubAPI.skipErrors()

  let ptvAPI = new PTVAPI(stubAPI)
  ptvAPI.addMetroSite(stubAPI)

  return ptvAPI
}

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
    it('Should only accept trips in the form vic:02SUY:_:R:vpt._Sunbury_6168_20250603', async () => {
      expect(UnscheduledMetroGTFSRTrip.canProcess({ trip_id: '02-PKM--52-T5-C078' })).to.be.false
      expect(UnscheduledMetroGTFSRTrip.canProcess({ trip_id: '02-BEG--52-T5-3605' })).to.be.false
      expect(UnscheduledMetroGTFSRTrip.canProcess({ trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6168_20250603' })).to.be.true
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
  })
})
