import { expect } from 'chai'
import mdd1000 from './sample-data/mdd-1000.json' with { type: 'json' }
import LiveTimetable from '../live-timetable.js'

describe('The LiveTimetable schema', () => {
  it('Should allow object creation from a database object', async () => {
    let timetable = LiveTimetable.fromDatabase(mdd1000)

    expect(timetable.mode).to.equal('metro train')
    expect(timetable.routeGTFSID).to.equal('2-MDD')
    expect(timetable.routeName).to.equal('Mernda')
    expect(timetable.operationDay).to.equal('20250410')
    expect(timetable.operationDayMoment.toISOString()).to.equal('2025-04-09T14:00:00.000Z')
    expect(timetable.block).to.equal('11393')
    expect(timetable.tripID).to.equal('02-MDD--23-T5-1000')
    expect(timetable.shapeID).to.equal('2-MDD-vpt-23.1.R')
    expect(timetable.runID).to.equal('1000')
    expect(timetable.direction).to.equal('Up')
    expect(timetable.isRRB).to.be.false

    expect(timetable.origin).to.equal('Mernda Railway Station')
    expect(timetable.departureTime).to.equal('04:04')
    expect(timetable.destination).to.equal('Flinders Street Railway Station')
    expect(timetable.destinationArrivalTime).to.equal('04:56')

    expect(timetable.formedBy).to.equal('1999')
    expect(timetable.forming).to.equal('1801')

    expect(timetable.stops[0].stopName).to.equal('Mernda Railway Station')
    expect(timetable.stops[0].stopGTFSID).to.equal('26517')
    expect(timetable.stops[0].departureTime).to.equal('04:04')
    expect(timetable.stops[0].platform).to.equal('1')
    expect(timetable.stops[0].scheduledDepartureTime.toISOString()).to.equal('2025-04-09T18:04:00.000Z')
    expect(timetable.stops[0].actualDepartureTime.toISOString()).to.equal('2025-04-09T18:03:40.000Z')

    expect(timetable.stops[1].stopName).to.equal('Hawkstowe Railway Station')
    expect(timetable.stops[1].stopGTFSID).to.equal('26511')
    expect(timetable.stops[1].departureTime).to.equal('04:07')
    expect(timetable.stops[1].platform).to.equal('1')
    expect(timetable.stops[1].scheduledDepartureTime.toISOString()).to.equal('2025-04-09T18:07:00.000Z')
    expect(timetable.stops[1].actualDepartureTime.toISOString()).to.equal('2025-04-09T18:10:00.000Z')
  })
})