import { expect } from 'chai'
import isDSTChange from '../dst.js'

describe('The DST function', () => {
  it('Should identify if a given day is the first day of a time change', () => {
    expect(isDSTChange(new Date('2025-03-29T08:59:53.716Z'))).to.be.false
    expect(isDSTChange(new Date('2025-04-05T08:59:53.716Z'))).to.be.false
    expect(isDSTChange(new Date('2025-04-06T08:59:53.716Z'))).to.be.true // 2am is repeated this day

    expect(isDSTChange(new Date('2024-10-05T08:59:53.716Z'))).to.be.false
    expect(isDSTChange(new Date('2024-10-06T08:59:53.716Z'))).to.be.true // 2am is skipped this day
    expect(isDSTChange(new Date('2024-10-07T08:59:53.716Z'))).to.be.false
  })
})