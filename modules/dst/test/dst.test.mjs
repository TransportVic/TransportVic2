import { expect } from 'chai'
import { getTimeOffset, isDSTChange } from '../dst.js'

describe('The DST function', () => {
  it('Should identify if a given day is the first day of a time change', () => {
    expect(isDSTChange(new Date('2025-03-29T08:59:53.716Z'))).to.be.false
    expect(isDSTChange(new Date('2025-04-05T08:59:53.716Z'))).to.be.false
    expect(isDSTChange(new Date('2025-04-06T08:59:53.716Z'))).to.be.true // 2am is repeated this day

    expect(isDSTChange(new Date('2024-10-05T08:59:53.716Z'))).to.be.false
    expect(isDSTChange(new Date('2024-10-06T08:59:53.716Z'))).to.be.true // 2am is skipped this day
    expect(isDSTChange(new Date('2024-10-07T08:59:53.716Z'))).to.be.false
  })
  
  it('Should still return the correct result even if midnight is given', () => {
    expect(isDSTChange(new Date('2025-04-04T13:00:00.000Z'))).to.be.false // 5 april midnight
    expect(isDSTChange(new Date('2025-04-05T13:00:00.000Z'))).to.be.true // 6 april midnight
    expect(isDSTChange(new Date('2025-04-06T14:00:00.000Z'))).to.be.false // 7 april midnight
  })

  it('Should return the HH:MM and minutes offset on a given day', () => {
    expect(getTimeOffset(new Date('2025-03-29T08:59:53.716Z'))).to.equal(0)
    expect(getTimeOffset(new Date('2025-04-06T08:59:53.716Z'))).to.equal(60) // Extra 60 minutes to account for the repeated 2am

    expect(getTimeOffset(new Date('2024-10-06T08:59:53.716Z'))).to.equal(-60) // 60 less minutes to account for the skipped 2am
    expect(getTimeOffset(new Date('2024-10-05T14:00:00.000Z'))).to.equal(-60) // 60 less minutes to account for the skipped 2am
  })
})