import { expect, use } from 'chai'
import mdd1000 from './sample-data/mdd-1000.json' with { type: 'json' }
import ccl0735 from './sample-data/ccl-0735.json' with { type: 'json' }
import pkmC143 from './sample-data/pkm-C143.json' with { type: 'json' }
import cbe4201 from './sample-data/cbe-4201.json' with { type: 'json' }
import { BusLiveTimetable, LiveTimetable } from '../../modules/schema/live-timetable.mjs'
import chaiExclude from 'chai-exclude'
import utils from '../../utils.mjs'
import beg3152 from './sample-data/beg-3152.mjs'
import bus200Data from './sample-data/bus-200-data.mjs'
import bus670Data from './sample-data/bus-670-data.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import chirnsidePark from './sample-data/chirnside-park.mjs'
use(chaiExclude)

let clone = o => JSON.parse(JSON.stringify(o))

const bus200DataNoStops = Object.keys(bus200Data).reduce(
  (acc, key) => key === 'stopTimings' ? ({ ...acc, stopTimings: [] })
  : key === 'vehicle' ? acc
  : key === 'changes' ? acc
  : ({ ...acc, [key]: bus200Data[key]}),
{})

describe('The LiveTimetable class', () => {
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
    expect(timetable.gtfsDirection).to.equal(1)
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

    expect(timetable.lastUpdated.toISOString()).to.equal('2025-04-09T18:37:00.000Z')

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

    expect(dbObj.lastUpdated).to.equal(+new Date('2025-04-09T18:37:00.000Z'))

    expect(dbObj.stopTimings[0].stopName).to.equal('Mernda Railway Station')
    expect(dbObj.stopTimings[0].arrivalTime).to.equal('04:04')
    expect(dbObj.stopTimings[0].arrivalTimeMinutes).to.equal(244)
    expect(dbObj.stopTimings[0].departureTime).to.equal('04:04')
    expect(dbObj.stopTimings[0].departureTimeMinutes).to.equal(244)

    expect(dbObj.stopTimings[0].estimatedDepartureTime).to.equal('2025-04-09T18:03:40.000Z')
    expect(dbObj.stopTimings[0].scheduledDepartureTime).to.equal('2025-04-09T18:04:00.000Z')
    expect(dbObj.stopTimings[0].scheduledDepartureTimeMS).to.equal(+new Date('2025-04-09T18:04:00.000Z'))
    expect(dbObj.stopTimings[0].actualDepartureTimeMS).to.equal(+new Date('2025-04-09T18:03:40.000Z'))
    expect(dbObj.stopTimings[0].platform).to.equal('1')
    expect(dbObj.stopTimings[0].cancelled).to.be.false
    expect(dbObj.stopTimings[0].stopConditions).to.deep.equal({
      pickup: 0, dropoff: 1
    })
  })

  it('Should use PT times on the trip departure and arrival times', () => {
    let timetable = LiveTimetable.fromDatabase(pkmC143)
    expect(timetable.departureTime).to.equal('23:48')
    expect(timetable.destinationArrivalTime).to.equal('25:00')
    
    let dbObj = timetable.toDatabase()
    expect(dbObj.departureTime).to.equal('23:48')
    expect(dbObj.destinationArrivalTime).to.equal('25:00')
    
    expect(dbObj.stopTimings[0].departureTime).to.equal('23:48')
    expect(dbObj.stopTimings[dbObj.stopTimings.length - 1].arrivalTime).to.equal('01:00')
  })

  it('Should allow creation of a new trip', () => {
    let timetable = new LiveTimetable(
      'metro train',
      new Date('2025-04-09T18:04:00.000Z'),
      'Mernda',
      null,
      '2-MDD',
      null,
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

  it('Should handle some trip stops not having stop conditions', () => {
    let trip = clone(mdd1000)
    trip.stopTimings.forEach(stop => delete stop.stopConditions)
    let timetable = LiveTimetable.fromDatabase(trip)
    expect(timetable).to.exist
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

  it('Does not produce a change entry if logging is disabled, but should still log under newChanges', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    timetable.logChanges = false
    timetable.forming = '3800'

    expect(timetable.changes.length).to.equal(0)
    expect(timetable.newChanges.length).to.equal(1)
    expect(timetable.newChanges[0].type).to.equal('forming-change')
    expect(timetable.newChanges[0].oldVal).to.equal('0737')
    expect(timetable.newChanges[0].newVal).to.equal('3800')
    expect(timetable.newChanges[0].timestamp).to.exist

    timetable.formedBy = '0400'

    expect(timetable.changes.length).to.equal(0)
    expect(timetable.newChanges.length).to.equal(2)
    expect(timetable.newChanges[1].type).to.equal('formedby-change')
    expect(timetable.newChanges[1].oldVal).to.equal('0733')
    expect(timetable.newChanges[1].newVal).to.equal('0400')
    expect(timetable.newChanges[1].timestamp).to.exist
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

  it('Should not create change log entries if the fleet does not change', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null
    timetable.consist = ['189M', '1395T', '190M', '875M', '1638T', '876M']
    let expectedVehicle = {
      size: 6,
      type: 'Xtrapolis',
      consist: ['189M', '1395T', '190M', '875M', '1638T', '876M']
    }

    expect(timetable.vehicle).to.deep.equal(expectedVehicle)
    expect(timetable.toDatabase().vehicle).to.deep.equal(expectedVehicle)
    expect(timetable.changes[0]).excluding('timestamp').excluding('source').to.deep.equal({
      type: 'veh-change',
      oldVal: null,
      newVal: expectedVehicle
    })

    timetable.consist = ['189M', '1395T', '190M', '875M', '1638T', '876M']
    expect(timetable.changes.length).to.equal(1)
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
      routeGTFSID: '2-CCL',
      routeName: 'City Circle',
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

  it('Updates the origin/destination in the tracker data if the trip is altered', () => {
    let timetable = LiveTimetable.fromDatabase(mdd1000)
    // Cancel MDD-SMH, originates EPP now
    for (let i = 0; i < 4; i++) timetable.stops[i].cancelled = true
    // Cancel CWD-FSS, terminates VPK now
    for (let i = timetable.stops.length - 5; i < timetable.stops.length; i++) timetable.stops[i].cancelled = true
    timetable.consist = ['189M', '1395T', '190M', '857M', '1638T', '876M']

    expect(timetable.toTrackerDatabase()).to.deep.equal({
      date: '20250410',
      routeGTFSID: '2-MDD',
      routeName: 'Mernda',
      runID: '1000',
      origin: 'Epping',
      departureTime: '04:16',
      destination: 'Victoria Park',
      destinationArrivalTime: '04:47',
      consist: ['189M', '1395T', '190M', '857M', '1638T', '876M']
    })

    expect(timetable.getTrackerDatabaseKey()).to.deep.equal({
      date: '20250410',
      runID: '1000'
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
      routeGTFSID: '2-CCL',
      routeName: 'City Circle',
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

  it('Should maintain extra attributes kept in special trips', () => {
    let timetable = LiveTimetable.fromDatabase(cbe4201)
    let dbObj = timetable.toDatabase()
    expect(dbObj.circular).to.equal("TEST")
    expect(dbObj.stopTimings[0].stopGTFSID).to.equal('vic:rail:DNG')
    expect(dbObj.stopTimings[0].track).to.equal('C')
    expect(dbObj.stopTimings[0].express).to.be.false

    expect(dbObj.stopTimings[1].stopGTFSID).to.equal('vic:rail:LBK')
    expect(dbObj.stopTimings[1].track).to.be.null
    expect(dbObj.stopTimings[1].express).to.be.true
  })

  it('Should not maintain extra attributes not in normal trips', () => {
    let timetable = LiveTimetable.fromDatabase(mdd1000)
    let dbObj = timetable.toDatabase()
    expect(dbObj.circular).to.not.exist
    expect(dbObj.stopTimings[0].stopGTFSID).to.equal('26517')
    expect(dbObj.stopTimings[0].track).to.not.exist
    expect(dbObj.stopTimings[0].express).to.not.exist
  })

  describe('Transposal handling', () => {
    let originalNow
    before(() => {
      originalNow = utils.now
    })

    it('Blocks vehicle assignments in the last 10min (scheduled) of the trip if the trip is transposed', () => {
      utils.now = () => utils.parseTime('2025-04-09T18:51:00.000Z') // time now is :51, arrives into FSS at :56

      let timetable = LiveTimetable.fromDatabase(mdd1000)
      timetable.forming = '9999'
      timetable.consist = ['703M', '2502T', '704M']

      expect(timetable.vehicle).to.deep.equal({
        size: 6,
        type: 'Xtrapolis',
        consist: [
          '189M', '1395T', '190M',
          '875M', '1638T', '876M'
        ]
      })
    })

    it('Does not block vehicle assignments before the last 10min (scheduled) of the trip if the trip is transposed', () => {
      utils.now = () => utils.parseTime('2025-04-09T18:30:00.000Z') // time now is :51, arrives into FSS at :56

      let timetable = LiveTimetable.fromDatabase(mdd1000)
      timetable.forming = '9999'
      timetable.consist = ['703M', '2502T', '704M']

      expect(timetable.vehicle).to.deep.equal({
        size: 3,
        type: 'Siemens',
        consist: [ '703M', '2502T', '704M' ]
      })
    })

    it('Does not block vehicle assignments if the trip is transposed but not previous consist data was available', () => {
      let trip = clone(mdd1000)
      trip.vehicle = null

      let timetable = LiveTimetable.fromDatabase(trip)
      timetable.forming = '9999'
      timetable.consist = ['703M', '2502T', '704M']

      expect(timetable.vehicle).to.deep.equal({
        size: 3,
        type: 'Siemens',
        consist: [ '703M', '2502T', '704M' ]
      })
    })

    it('Does not block forced vehicle assignments if the trip is transposed', () => {
      let timetable = LiveTimetable.fromDatabase(mdd1000)
      timetable.forming = '9999'
      timetable.forcedVehicle = {
        consist: ['703M', '2502T', '704M']
      }

      expect(timetable.vehicle).to.deep.equal({
        size: 3,
        type: 'Siemens',
        forced: true,
        consist: [ '703M', '2502T', '704M' ]
      })
    })

     after(() => {
      utils.now = originalNow
    })
  })

  it('Should track a change in the departure time from a stop', () => {
    let timetable = LiveTimetable.fromDatabase(mdd1000)
    timetable.updateStopByName('Mernda Railway Station', {
      scheduledDepartureTime: '2025-08-08T12:57:00.000Z'
    })

    expect(timetable.changes.length).to.equal(1)
    expect(timetable.changes[0].type).to.equal('stop-time-change')
    expect(timetable.changes[0].stopName).to.equal('Mernda Railway Station')
    expect(timetable.changes[0].oldVal).to.equal('2025-04-09T18:04:00.000Z')
    expect(timetable.changes[0].newVal).to.equal('2025-08-08T12:57:00.000Z')
    expect(timetable.changes[0].timestamp).to.exist
  })

  it('Sets the comeng variant on a 3 car train', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = ['665M', '1182T', '666M']
    expect(timetable.vehicle).to.deep.equal({
      size: 3,
      type: 'Comeng',
      consist: ['665M', '1182T', '666M'],
      variant: 'NS'
    })
  })

  it('Sets the comeng variant on a 6 car train', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = ['329M', '1015T', '366M', '328M', '1014T', '464M']
    expect(timetable.vehicle).to.deep.equal({
      size: 6,
      type: 'Comeng',
      consist: ['329M', '1015T', '366M', '328M', '1014T', '464M'],
      variant: 'SS'
    })
  })

  it('Uses a mixed variant on trips with both NS and SS sets', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = ['665M', '1182T', '666M', '328M', '1014T', '464M']
    expect(timetable.vehicle).to.deep.equal({
      size: 6,
      type: 'Comeng',
      consist: ['665M', '1182T', '666M', '328M', '1014T', '464M'],
      variant: 'Mixed'
    })
  })

  it('Uses changes from single to mixed variant on trips after partial matching', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = ['665M', '1182T', '666M']
    expect(timetable.vehicle).to.deep.equal({
      size: 3,
      type: 'Comeng',
      consist: ['665M', '1182T', '666M'],
      variant: 'NS'
    })

    timetable.consist = ['665M', '1182T', '666M', '328M', '1014T', '464M']
    expect(timetable.vehicle).to.deep.equal({
      size: 6,
      type: 'Comeng',
      consist: ['665M', '1182T', '666M', '328M', '1014T', '464M'],
      variant: 'Mixed'
    })
  })

  it('Updates variant type when merging 3 car trips', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)
    expect(timetable.vehicle).to.be.null

    timetable.consist = ['665M', '1182T', '666M']
    expect(timetable.vehicle).to.deep.equal({
      size: 3,
      type: 'Comeng',
      consist: ['665M', '1182T', '666M'],
      variant: 'NS'
    })

    timetable.consist = ['328M', '1014T', '464M']
    expect(timetable.vehicle).to.deep.equal({
      size: 6,
      type: 'Comeng',
      consist: ['665M', '1182T', '666M', '328M', '1014T', '464M'],
      variant: 'Mixed'
    })
  })

  it('Maintains stop distances as per the GTFS data', () => {
    let timetable = LiveTimetable.fromDatabase(ccl0735)

    expect(timetable.mode).to.equal('metro train')
    expect(timetable.routeGTFSID).to.equal('2-CCL')

    expect(timetable.stops[0].stopName).to.equal('Flinders Street Railway Station')
    expect(timetable.stops[0].stopDistance).to.equal(0.00)

    expect(timetable.stops[1].stopName).to.equal('Southern Cross Railway Station')
    expect(timetable.stops[1].stopDistance).to.equal(1470.67)

    let dbObj = timetable.toDatabase()
    expect(dbObj.stopTimings[0].stopName).to.equal('Flinders Street Railway Station')
    expect(dbObj.stopTimings[0].stopDistance).to.equal(0.00)

    expect(dbObj.stopTimings[1].stopName).to.equal('Southern Cross Railway Station')
    expect(dbObj.stopTimings[1].stopDistance).to.equal(1470.67)
  })

  it('Sets the arrival time as beyond 24:00 on midnight trips on DST start Sundays (no 2am)', () => {
    let timetable = LiveTimetable.fromDatabase(beg3152)

    expect(timetable.mode).to.equal('metro train')
    expect(timetable.routeGTFSID).to.equal('2-BEG')

    let dbObj = timetable.toDatabase()
    expect(dbObj.origin).to.equal('Belgrave Railway Station')
    expect(dbObj.departureTime).to.equal('25:36')
    expect(dbObj.stopTimings[0].departureTime).to.equal('01:36')
    
    expect(dbObj.destination).to.equal('Ringwood Railway Station')
    expect(dbObj.destinationArrivalTime).to.equal('26:04')
    expect(dbObj.stopTimings[dbObj.stopTimings.length - 1].departureTime).to.equal('03:04')
  })

  it('Respects times beyond 24:00 on tracker database entries', () => {
    const timetable = LiveTimetable.fromDatabase(bus670Data)

    const tracker = timetable.toTrackerDatabase()
    expect(tracker.departureTime).to.equal('31:30')
    expect(tracker.destinationArrivalTime).to.equal('32:03')
  })

  it('Picks the BusLiveTimetable class for bus trips', () => {
    let timetable = LiveTimetable.fromDatabase(bus200Data)
    expect(timetable).to.be.instanceOf(BusLiveTimetable)
  })

  it('Does not set stop cancellation data for a skeleton trip with no stop times', () => {
    const timetable = LiveTimetable.fromDatabase(bus200DataNoStops)
    timetable.consist = ['BS04FL']

    const dbTrip = timetable.toDatabase()
    expect(dbTrip).to.not.have.property('stopTimings')
    expect(dbTrip.origin).to.equal(bus200Data.origin)
    expect(dbTrip.destination).to.equal(bus200Data.destination)
    expect(dbTrip.changes.length).to.equal(1)
    expect(dbTrip.changes[0].type).to.equal('veh-change')
  })

  it('Does not recalculate origin and dest for skeleton trips', () => {
    const timetable = LiveTimetable.fromDatabase(bus200DataNoStops)
    timetable.consist = ['BS04FL']

    const dbTrip = timetable.toTrackerDatabase()
    expect(dbTrip.origin).to.equal(bus200Data.origin)
    expect(dbTrip.destination).to.equal(bus200Data.destination)
    expect(dbTrip.departureTime).to.equal(bus200Data.departureTime)
    expect(dbTrip.destinationArrivalTime).to.equal(bus200Data.destinationArrivalTime)
  })

  it('Allows updating a stop by ID', async () => {
    const timetable = LiveTimetable.fromDatabase(bus670Data)
    const db = new LokiDatabaseConnection()
    const stops = await db.getCollection('stops')

    await timetable.updateStopByID('21318', 0, stops, {
      estimatedDepartureTime: new Date('2025-04-09T18:03:40.000Z')
    })

    expect(timetable.stops[0].estimatedDepartureTime.toISOString()).to.equal('2025-04-09T18:03:40.000Z')
  })

  it('Creates a stop if it does not exist when updating by ID', async () => {
    const timetable = LiveTimetable.fromDatabase(bus670Data)
    const db = new LokiDatabaseConnection()
    const stops = await db.getCollection('stops')
    await stops.createDocument(chirnsidePark)

    await timetable.updateStopByID('21300', 1, stops, {
      scheduledDepartureTime: new Date('2025-11-01T20:30:00.000Z'),
      estimatedDepartureTime: new Date('2025-04-09T18:03:40.000Z')
    })

    expect(timetable.stops[2].stopName).to.equal('Chirnside Park Shopping Centre/Maroondah Highway')
    expect(timetable.stops[2].suburb).to.equal('Chirnside Park')
    expect(timetable.stops[2].scheduledDepartureTime.toISOString()).to.equal('2025-11-01T20:30:00.000Z')
    expect(timetable.stops[2].estimatedDepartureTime.toISOString()).to.equal('2025-04-09T18:03:40.000Z')
  })

  it('Contains custom trip flags', () => {
    const timetable = LiveTimetable.fromDatabase(bus670Data)
    expect(timetable.flags).to.deep.equal({})
    timetable.flags.isNightNetwork = true

    expect(timetable.flags).to.deep.equal({
      isNightNetwork: true
    })
  })

  it('Exports custom trip flags', () => {
    const timetable = LiveTimetable.fromDatabase(bus670Data)
    expect(timetable.flags).to.deep.equal({})
    timetable.flags.isNightNetwork = true

    const dbTrip = timetable.toDatabase()
    expect(dbTrip.flags).to.deep.equal({
      isNightNetwork: true
    })
  })

  it('Imports custom trip flags', () => {
    const tripData = {
      ...clone(bus670Data),
      flags: { isNightNetwork: true }
    }
    const timetable = LiveTimetable.fromDatabase(tripData)
    expect(timetable.flags).to.deep.equal({
      isNightNetwork: true
    })
  })
})

describe('The BusLiveTimetable class', () => {
  it('Exports the full stop name to the tracker database', () => {
    let timetable = LiveTimetable.fromDatabase(bus200Data)
    expect(timetable.toTrackerDatabase()).to.deep.equal({
      date: '20251022',
      routeGTFSID: '4-200',
      routeName: 'Bulleen - City (Queen St)',
      runID: '14-200--1-MF18-200904',
      origin: 'Little Collins Street/Queen Street',
      destination: 'Bulleen Terminus/Thompsons Road',
      departureTime: '21:50',
      destinationArrivalTime: '22:37',
      consist: [ 'BS05CQ' ],
      routeNumber: '200',
      depot: '14'
    })
  })
})