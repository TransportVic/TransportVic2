import { expect } from 'chai'
import { RailGTFSRTrip, ScheduledRailGTFSRTrip, UnscheduledRailGTFSRTrip } from '../../gtfsr/GTFSRTrip.mjs'

describe('The GTFSRTrip class', () => {
  describe('The Scheduled trip class', () => {
    it('Should only accept trips in the form 02-PKM--52-T5-C078', async () => {
      expect(ScheduledRailGTFSRTrip.canProcess({ trip_id: '02-PKM--52-T5-C078' })).to.be.true
      expect(ScheduledRailGTFSRTrip.canProcess({ trip_id: '02-BEG--52-T5-3605' })).to.be.true
      expect(ScheduledRailGTFSRTrip.canProcess({ trip_id: '01-BAT--8-T2-8107' })).to.be.true
      expect(ScheduledRailGTFSRTrip.canProcess({ trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6168_20250603' })).to.be.false
    })

    it('Should extract the TDN', async () => {
      expect(new ScheduledRailGTFSRTrip({
        trip_id: '02-PKM--52-T5-C080',
        route_id: 'aus:vic:vic-02-PKM:',
        direction_id: 0,
        start_time: '14:23:00',
        start_date: '20250603',
        schedule_relationship: 0
      }).getTDN()).to.equal('C080')

      expect(new ScheduledRailGTFSRTrip({
        trip_id: '02-FKN--52-T5-4418',
        route_id: 'aus:vic:vic-02-FKN:',
        direction_id: 0,
        start_time: '14:38:00',
        start_date: '20250603',
        schedule_relationship: 0
      }).getTDN()).to.equal('4418')
    })

    it('Should extract the TDN for V/Line services', async () => {
      expect(new ScheduledRailGTFSRTrip({
        trip_id: '01-BAT--8-T2-8107',
        route_id: 'aus:vic:vic-01-BAT:',
        direction_id: 0,
        start_time: '14:23:00',
        start_date: '20250603',
        schedule_relationship: 0
      }).getTDN()).to.equal('8107')
    })

    it('Should extract the schedule relationship type', async () => {
      expect(new ScheduledRailGTFSRTrip({
        trip_id: '02-FKN--52-T5-4418',
        route_id: 'aus:vic:vic-02-FKN:',
        direction_id: 0,
        start_time: '14:38:00',
        start_date: '20250603',
        schedule_relationship: 0
      }).getScheduleRelationship()).to.equal(RailGTFSRTrip.SR_SCHEDULED)
    })
  })

  describe('The Unscheduled trip class', () => {
    it('Should only accept trips in the form vic:02SUY:_:R:vpt._Sunbury_6168_20250603', () => {
      expect(UnscheduledRailGTFSRTrip.canProcess({ trip_id: '02-PKM--52-T5-C078' })).to.be.false
      expect(UnscheduledRailGTFSRTrip.canProcess({ trip_id: '02-BEG--52-T5-3605' })).to.be.false
      expect(UnscheduledRailGTFSRTrip.canProcess({ trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6168_20250603' })).to.be.true
    })

    it('Should accept live trips without an operation day', () => {
      expect(UnscheduledRailGTFSRTrip.canProcess({ trip_id: 'vic:02WIL:_:R:vpt._Williamstown_7072_' })).to.be.true
    })

    it('Should extract the TDN', async () => {
      expect(new UnscheduledRailGTFSRTrip({
        trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6112_20250603',
        route_id: 'aus:vic:vic-02-SUY:',
        direction_id: 0,
        start_time: '15:37:00',
        start_date: '20250603',
        schedule_relationship: 1
      }).getTDN()).to.equal('6112')
    })

    it('Should extract the schedule relationship type', async () => {
      expect(new UnscheduledRailGTFSRTrip({
        trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6112_20250603',
        route_id: 'aus:vic:vic-02-SUY:',
        direction_id: 0,
        start_time: '15:37:00',
        start_date: '20250603',
        schedule_relationship: 1
      }).getScheduleRelationship()).to.equal(RailGTFSRTrip.SR_ADDED)
    })
  })

  it('Should automatically generate the correct parser', () => {
    expect(RailGTFSRTrip.parse({
      trip_id: 'vic:02SUY:_:R:vpt._Sunbury_6112_20250603',
      route_id: 'aus:vic:vic-02-SUY:',
      direction_id: 0,
      start_time: '15:37:00',
      start_date: '20250603',
      schedule_relationship: 1
    }).getTDN()).to.equal('6112')

    expect(RailGTFSRTrip.parse({
      trip_id: 'vic:02GWY:_:H:vpt._Glen Waverley_2083_20250719',
      route_id: 'aus:vic:vic-02-GWY:',
      direction_id: 0,
      start_time: '15:37:00',
      start_date: '20250603',
      schedule_relationship: 1
    }).getTDN()).to.equal('2083')

    expect(RailGTFSRTrip.parse({
      trip_id: '02-STY--52-T5-8514',
      route_id: 'aus:vic:vic-02-STY:',
      direction_id: 0,
      start_time: '15:29:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getTDN()).to.equal('8514')
    
    expect(RailGTFSRTrip.parse({
      trip_id: '02-STY--52-T5-8514',
      route_id: 'aus:vic:vic-02-STY:',
      direction_id: 0,
      start_time: '15:29:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getRouteID()).to.equal('2-STY')
    
    expect(RailGTFSRTrip.parse({
      trip_id: '01-BAT--8-T2-8107',
      route_id: 'aus:vic:vic-01-BAT:',
      direction_id: 0,
      start_time: '14:23:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getRouteID()).to.equal('1-BAT')
  })

  it('Should provide the start time', () => {
    expect(RailGTFSRTrip.parse({
      trip_id: '02-STY--52-T5-8514',
      route_id: 'aus:vic:vic-02-STY:',
      direction_id: 0,
      start_time: '15:29:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getStartTime()).to.equal('15:29')

    expect(RailGTFSRTrip.parse({
      trip_id: '02-STY--52-T5-8514',
      route_id: 'aus:vic:vic-02-STY:',
      direction_id: 0,
      start_time: '25:29:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getStartTime()).to.equal('01:29')

    expect(RailGTFSRTrip.parse({
      trip_id: '02-STY--52-T5-8514',
      route_id: 'aus:vic:vic-02-STY:',
      direction_id: 0,
      start_time: '05:29:00',
      start_date: '20250603',
      schedule_relationship: 0
    }).getStartTime()).to.equal('05:29')
  })

  it('Extracts just the basic data for unknown trips', () => {
    let data = RailGTFSRTrip.parse({
      trip_id: '1.T0.1-WBL-mjp-7.1.H',
      route_id: '1-WBL-mjp-7',
      direction_id: 0,
      start_time: '17:09:00',
      start_date: '20250806',
      schedule_relationship: 5
    })

    expect(data.getTDN()).to.not.exist
    expect(data.getStartTime()).to.equal('17:09')
    expect(data.getRouteID()).to.equal('1-WBL')
  })
})