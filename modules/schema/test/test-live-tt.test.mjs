import { expect } from 'chai'
import mdd1000 from './sample-data/mdd-1000.json' with { type: 'json' }
import LiveTimetable from '../live-timetable.js'

describe('The LiveTimetable schema', () => {
  it('Should allow object creation from a database object', () => {
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

  it('Should allow re exporting to a database object', () => {
    let timetable = LiveTimetable.fromDatabase(mdd1000)
    let dbObj = timetable.toDatabase()

    expect(dbObj.mode).to.equal('metro train')
    expect(dbObj.routeGTFSID).to.equal('2-MDD')
    expect(dbObj.routeName).to.equal('Mernda')
    expect(dbObj.operationDays).to.equal('20250410')
    expect(dbObj.block).to.equal('11393')
    expect(dbObj.tripID).to.equal('02-MDD--23-T5-1000')
    expect(dbObj.shapeID).to.equal('2-MDD-vpt-23.1.R')
    expect(dbObj.runID).to.equal('1000')
    expect(dbObj.direction).to.equal('Up')
    expect(dbObj.isRailReplacementBus).to.be.false

    expect(dbObj.origin).to.equal('Mernda Railway Station')
    expect(dbObj.departureTime).to.equal('04:04')
    expect(dbObj.destination).to.equal('Flinders Street Railway Station')
    expect(dbObj.destinationArrivalTime).to.equal('04:56')

    expect(dbObj.stopTimings[0].stopName).to.equal('Mernda Railway Station')
    expect(dbObj.stopTimings[0].arrivalTime).to.equal('04:04')
    expect(dbObj.stopTimings[0].arrivalTimeMinutes).to.equal(244)
    expect(dbObj.stopTimings[0].departureTime).to.equal('04:04')
    expect(dbObj.stopTimings[0].departureTimeMinutes).to.equal(244)

    expect(dbObj.stopTimings[0].estimatedDepartureTime).to.equal('2025-04-09T18:03:40.000Z')
    expect(dbObj.stopTimings[0].scheduledDepartureTime).to.equal('2025-04-09T18:04:00.000Z')
    expect(dbObj.stopTimings[0].actualDepartureTimeMS).to.equal(+new Date('2025-04-09T18:03:40.000Z'))
    expect(dbObj.stopTimings[0].platform).to.equal('1')
    expect(dbObj.stopTimings[0].cancelled).to.be.false
  })
})