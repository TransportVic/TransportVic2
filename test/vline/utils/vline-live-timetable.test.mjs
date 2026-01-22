import { expect } from 'chai'
import td8741 from './sample-data/td8741-live.json' with { type: 'json' }
import { VLineLiveTimetable } from '../../../modules/schema/live-timetable.mjs'

describe('The V/Line Live Timetable', () => {
  it('Sets a VLocity\'s vehicle type', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ 'VL30' ]
    console.log(timetable.vehicle)
    expect(timetable.vehicle).to.deep.equal({
      consist: ['VL30'],
      size: 1,
      type: 'VLocity'
    })
  })

  it('Is future proof on VLocities', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ 'VL999' ]
    console.log(timetable.vehicle)
    expect(timetable.vehicle).to.deep.equal({
      consist: ['VL999'],
      size: 1,
      type: 'VLocity'
    })
  })

  it('Sets a Sprinter\'s vehicle type', async () => {
    const timetable = VLineLiveTimetable.fromDatabase(td8741)
    expect(timetable.vehicle).to.not.exist
    timetable.consist = [ '7000' ]
    console.log(timetable.vehicle)
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
    console.log(timetable.vehicle)
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
    console.log(timetable.vehicle)
    expect(timetable.vehicle).to.deep.equal({
      consist: ['Train'],
      size: 1,
      type: 'Unknown'
    })
  })
})