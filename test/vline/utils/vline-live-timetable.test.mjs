import { expect } from 'chai'
import td8741 from './sample-data/td8741-live.json' with { type: 'json' }
import { VLineLiveTimetable } from '../../../modules/schema/live-timetable.mjs'

describe('The V/Line Live Timetable', () => {
  it('Allows setting of a blank vehicle based on scheduled data', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.forcedVehicle = {
      consist: [],
      size: 6,
      type: 'VLocity'
    }

    expect(timetable.vehicle).to.deep.equal({
      consist: [],
      size: 6,
      type: 'VLocity',
      forced: true
    })
  })

  it('Sets a VLocity\'s vehicle type', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ 'VL30' ]

    expect(timetable.vehicle).to.deep.equal({
      consist: ['VL30'],
      size: 3,
      type: 'VLocity'
    })
  })

  it('Does not override the forced consist size', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.forcedVehicle = {
      consist: [],
      size: 6,
      type: 'VLocity'
    }

    timetable.consist = [ 'VL30' ]
    expect(timetable.vehicle).to.deep.equal({
      consist: ['VL30'],
      size: 6,
      type: 'VLocity'
    })
  })

  it('Is future proof on VLocities', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ 'VL999' ]

    expect(timetable.vehicle).to.deep.equal({
      consist: ['VL999'],
      size: 3,
      type: 'VLocity'
    })
  })

  it('Sets a Sprinter\'s vehicle type', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ '7000' ]

    expect(timetable.vehicle).to.deep.equal({
      consist: ['7000'],
      size: 1,
      type: 'Sprinter'
    })
  })

  it('Sets an N class\'s vehicle type', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ 'N450' ]

    expect(timetable.vehicle).to.deep.equal({
      consist: ['N450'],
      size: 1,
      type: 'N Set'
    })
  })

  it('Defaults to unknown', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ 'Train' ]

    expect(timetable.vehicle).to.deep.equal({
      consist: ['Train'],
      size: 1,
      type: 'Unknown'
    })
  })
})