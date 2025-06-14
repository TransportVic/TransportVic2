import { expect, use } from 'chai'
import mdd1000 from './sample-data/mdd-1000.json' with { type: 'json' }
import ccl0735 from './sample-data/ccl-0735.json' with { type: 'json' }
import LiveTimetable from '../live-timetable.js'
import chaiExclude from 'chai-exclude'
use(chaiExclude)

let clone = o => JSON.parse(JSON.stringify(o))

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
    expect(timetable.additional).to.be.true

    expect(timetable.vehicle).to.deep.equal({
      size: 6,
      type: 'Xtrapolis',
      consist: [
        '189M', '1395T', '190M',
        '875M', '1638T', '876M'
      ]
    })

    expect(timetable.origin).to.equal('Mernda Railway Station')
    expect(timetable.departureTime).to.equal('04:04')
    expect(timetable.destination).to.equal('Flinders Street Railway Station')
    expect(timetable.destinationArrivalTime).to.equal('04:56')

    expect(timetable.formedBy).to.equal('1999')
    expect(timetable.forming).to.equal('1801')

    expect(timetable.stops[0].stopName).to.equal('Mernda Railway Station')
    expect(timetable.stops[0].stopGTFSID).to.equal('26517')
    expect(timetable.stops[0].departureTime).to.equal('04:04')
    expect(timetable.stops[0].departureTimeMinutes).to.equal(244)
    expect(timetable.stops[0].platform).to.equal('1')
    expect(timetable.stops[0].scheduledDepartureTime.toISOString()).to.equal('2025-04-09T18:04:00.000Z')
    expect(timetable.stops[0].actualDepartureTime.toISOString()).to.equal('2025-04-09T18:03:40.000Z')
    expect(timetable.stops[0].allowPickup).to.be.true
    expect(timetable.stops[0].allowDropoff).to.be.false

    expect(timetable.stops[1].stopName).to.equal('Hawkstowe Railway Station')
    expect(timetable.stops[1].stopGTFSID).to.equal('26511')
    expect(timetable.stops[1].departureTime).to.equal('04:07')
    expect(timetable.stops[1].departureTimeMinutes).to.equal(247)
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
    expect(dbObj.additional).to.be.true

    expect(dbObj.vehicle).to.deep.equal({
      size: 6,
      type: 'Xtrapolis',
      consist: [
        '189M', '1395T', '190M',
        '875M', '1638T', '876M'
      ]
    })

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
    expect(dbObj.stopTimings[0].stopConditions).to.deep.equal({
      pickup: 0, dropoff: 1
    })
  })

  it('Should allow creation of a new trip', () => {
    let timetable = new LiveTimetable(
      'metro train',
      new Date('2025-04-09T18:04:00.000Z'),
      'Mernda',
      null,
      '2-MDD',
      null,
      null
    )

    timetable.updateStopByName('Mernda Railway Station', {
      stopGTFSID: '26517',
      stopNumber: null,
      suburb: 'Mernda',
      scheduledDepartureTime: new Date('2025-04-09T18:04:00.000Z'),
      estimatedDepartureTime: new Date('2025-04-09T18:03:40.000Z'),
      platform: 1
    })

    timetable.updateStopByName('Flinders Street Railway Station', {
      stopGTFSID: '11212',
      stopNumber: null,
      suburb: 'Melbourne',
      scheduledDepartureTime: new Date('2025-04-09T18:56:00.000Z'),
      estimatedDepartureTime: new Date('2025-04-09T18:56:00.000Z'),
      platform: 1
    })

    timetable.runID = '1000'
    timetable.direction = 'Up'
    timetable.isRRB = false

    expect(timetable.operationDay).to.equal('20250410')
    expect(timetable.operationDayMoment.toISOString()).to.equal('2025-04-09T14:00:00.000Z')
    expect(timetable.runID).to.equal('1000')
    expect(timetable.direction).to.equal('Up')
    expect(timetable.isRRB).to.be.false

    expect(timetable.origin).to.equal('Mernda Railway Station')
    expect(timetable.departureTime).to.equal('04:04')
    expect(timetable.destination).to.equal('Flinders Street Railway Station')
    expect(timetable.destinationArrivalTime).to.equal('04:56')
  })

  it('Should allow updating an existing trip', () => {
    let timetable = LiveTimetable.fromDatabase(mdd1000)

    timetable.forming = '1999'

    timetable.updateStopByName('Jolimont Railway Station', {
      estimatedDepartureTime: new Date('2025-04-09T18:56:00.000Z'),
      platform: 5
    })

    expect(timetable.stops[timetable.stops.length - 2].estimatedDepartureTime.toISOString()).to.equal('2025-04-09T18:56:00.000Z')
    expect(timetable.stops[timetable.stops.length - 2].platform).to.equal('5')
    expect(timetable.forming).to.equal('1999')
  })

  it('Should handle a stop being served multiple times', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)

    let delays = [0, 1, 2, 3, 4, 5]

    for (let delay of delays) {
      let stopData = timetable.stops[delay]
      let stopName = stopData.stopName
      timetable.updateStopByName(stopName, {
        estimatedDepartureTime: stopData.scheduledDepartureTime.add(delay, 'minutes')
      }, { prefSchTime: stopData.scheduledDepartureTime })
    }

    // First time FSS is served
    expect(timetable.stops[0].estimatedDepartureTime.toISOString()).to.equal('2025-04-04T23:53:00.000Z')
    expect(timetable.stops[1].estimatedDepartureTime.toISOString()).to.equal('2025-04-04T23:57:00.000Z')

    // Second time FSS is served
    expect(timetable.stops[5].estimatedDepartureTime.toISOString()).to.equal('2025-04-05T00:10:00.000Z')
  })

  it('Should track a change in forming/formed by data', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    timetable.forming = '3800'

    expect(timetable.changes.length).to.equal(1)
    expect(timetable.changes[0].type).to.equal('forming-change')
    expect(timetable.changes[0].oldVal).to.equal('0737')
    expect(timetable.changes[0].newVal).to.equal('3800')
    expect(timetable.changes[0].timestamp).to.exist

    timetable.formedBy = '0400'

    expect(timetable.changes.length).to.equal(2)
    expect(timetable.changes[1].type).to.equal('formedby-change')
    expect(timetable.changes[1].oldVal).to.equal('0733')
    expect(timetable.changes[1].newVal).to.equal('0400')
    expect(timetable.changes[1].timestamp).to.exist
  })

  it('Should disallow invalid cancellation values', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.cancelled).to.be.false
    timetable.cancelled = undefined
    expect(timetable.cancelled).to.be.false
    timetable.cancelled = true
    expect(timetable.cancelled).to.be.true
    timetable.cancelled = undefined
    expect(timetable.cancelled).to.be.true
    timetable.cancelled = false
    expect(timetable.cancelled).to.be.false
  })

  it('Should allow setting a vehicle type', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null
    timetable.consist = ['189M', '1395T', '190M']
    let expectedVehicle = {
      size: 3,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M']
    }

    expect(timetable.vehicle).to.deep.equal(expectedVehicle)
    expect(timetable.toDatabase().vehicle).to.deep.equal(expectedVehicle)
    expect(timetable.changes[0]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: null,
      newVal: expectedVehicle
    })
  })

  it('Should not allow downgrading from 6 cars to 3 cars if the consist is the same', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    let expectedVehicle = {
      size: 6,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M', '875M', '1638T', '876M']
    }
    expect(timetable.vehicle).to.be.null

    timetable.consist = [
      '189M', '1395T', '190M',
      '875M', '1638T', '876M'
    ]
    expect(timetable.vehicle).to.deep.equal(expectedVehicle)

    timetable.consist = [
      '189M', '1395T', '190M'
    ]
    expect(timetable.vehicle).to.deep.equal(expectedVehicle)
    expect(timetable.changes.length).to.equal(1)
  })

  it('Should replace a 6 car with a 3 car consist if it is totally different', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = [
      '189M', '1395T', '190M',
      '875M', '1638T', '876M'
    ]
    expect(timetable.vehicle).to.deep.equal({
      size: 6,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M', '875M', '1638T', '876M']
    })
    expect(timetable.changes[0]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: null,
      newVal: timetable.vehicle
    })
    
    let oldVehicle = clone(timetable.vehicle)
    timetable.consist = [
      '39M', '1320T', '40M'
    ]
    expect(timetable.vehicle).to.deep.equal({
      size: 3,
      type: 'Xtrapolis',
      consist: ['39M', '1320T', '40M']
    })
    expect(timetable.changes[1]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: oldVehicle,
      newVal: timetable.vehicle
    })
  })

  it('Should allow combining both halves of a 6 car consist if they detect separately', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = [
      '189M', '1395T', '190M'
    ]
    expect(timetable.vehicle).to.deep.equal({
      size: 3,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M']
    })
    expect(timetable.changes[0]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: null,
      newVal: timetable.vehicle
    })

    let oldVehicle = clone(timetable.vehicle)
    timetable.consist = [
      '875M', '1638T', '876M'
    ]
    expect(timetable.vehicle).to.deep.equal({
      size: 6,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M', '875M', '1638T', '876M']
    })
    expect(timetable.changes[1]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: oldVehicle,
      newVal: timetable.vehicle
    })
  })

  it('Should should not duplicate a 3 car when being updated twice', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = [
      '189M', '1395T', '190M'
    ]
    expect(timetable.vehicle).to.deep.equal({
      size: 3,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M']
    })

    timetable.consist = [
      '189M', '1395T', '190M'
    ]
    expect(timetable.vehicle).to.deep.equal({
      size: 3,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M']
    })
  })

  it('Should not update null consists', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    let expectedVehicle = {
      size: 3,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M']
    }
    expect(timetable.vehicle).to.be.null

    timetable.consist = ['189M', '1395T', '190M']
    expect(timetable.vehicle).to.deep.equal(expectedVehicle)
    timetable.consist = null
    expect(timetable.vehicle).to.deep.equal(expectedVehicle)
    timetable.consist = []
    expect(timetable.vehicle).to.deep.equal(expectedVehicle)
    expect(timetable.changes.length).to.equal(1)
  })

  it('Should allow forcing a consist', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    let expectedVehicle = {
      size: 3,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M']
    }
    let forcedVehicle = {
      size: 7,
      type: 'Steam Train',
      consist: ['N456', '1M', '9001'],
      icon: 'AClass'
    }
    let expectedForcedVehicle = { ...forcedVehicle, forced: true }
    timetable.consist = ['189M', '1395T', '190M']
    expect(timetable.vehicle).to.deep.equal(expectedVehicle)
    expect(timetable.changes[0]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: null,
      newVal: expectedVehicle
    })

    timetable.forcedVehicle = forcedVehicle
    expect(timetable.vehicle).to.deep.equal(expectedForcedVehicle)

    // Setting the consist here should no longer apply
    timetable.consist = ['189M', '1395T', '190M']
    expect(timetable.vehicle).to.deep.equal(expectedForcedVehicle)

    expect(timetable.changes[1]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: expectedVehicle,
      newVal: expectedForcedVehicle
    })
  })

  it('Should ensure the forced vehicle flag is saved/read from the DB', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    let forcedVehicle = {
      size: 7,
      type: 'Steam Train',
      consist: ['N456', '1M', '9001'],
      icon: 'AClass'
    }
    timetable.forcedVehicle = forcedVehicle
    let newTimetable = LiveTimetable.fromDatabase(timetable.toDatabase())
    expect(newTimetable.vehicle.forced).to.be.true

    newTimetable.consist = ['189M', '1395T', '190M']
    expect(newTimetable.vehicle.consist).to.deep.equal(['N456', '1M', '9001'])
    expect(newTimetable.vehicle.icon).to.equal('AClass')
  })

  it('Should still lookup the metro fleet type if forced but not specified', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    let forcedVehicle = {
      consist: ['875M', '1638T', '876M'],
    }
    let expectedForcedVehicle = {
      size: 3,
      type: 'Xtrapolis',
      consist: ['875M', '1638T', '876M'],
      forced: true
    }

    timetable.forcedVehicle = forcedVehicle
    expect(timetable.vehicle).to.deep.equal(expectedForcedVehicle)

    expect(timetable.changes[0]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: null,
      newVal: expectedForcedVehicle
    })
  })

  it('Should allow exporting to a metro trips tracker format', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    timetable.consist = ['189M', '1395T', '190M']
    expect(timetable.toTrackerDatabase()).to.deep.equal({
      date: '20250405',
      runID: '0735',
      origin: 'Flinders Street',
      departureTime: '10:53',
      destination: 'Flinders Street',
      destinationArrivalTime: '11:05',
      consist: ['189M', '1395T', '190M']
    })

    expect(timetable.getTrackerDatabaseKey()).to.deep.equal({
      date: '20250405',
      runID: '0735'
    })
  })

  it('Should not return a tracker database entry if no consist data is available', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)

    expect(timetable.toTrackerDatabase()).to.be.null
    expect(timetable.getTrackerDatabaseKey()).to.be.null
  })

  it('Should return a forced flag if the vehicle was forced', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    timetable.forcedVehicle = {
      size: 7,
      type: 'Steam Train',
      consist: ['N456', '1M', '9001'],
      icon: 'AClass'
    }

    expect(timetable.toTrackerDatabase()).to.deep.equal({
      date: '20250405',
      runID: '0735',
      origin: 'Flinders Street',
      departureTime: '10:53',
      destination: 'Flinders Street',
      destinationArrivalTime: '11:05',
      consist: ['N456', '1M', '9001'],
      size: 7,
      icon: 'AClass',
      forced: true
    })

    expect(timetable.getTrackerDatabaseKey()).to.deep.equal({
      date: '20250405',
      runID: '0735'
    })
  })
})