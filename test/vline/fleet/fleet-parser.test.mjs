import { expect } from 'chai'
import parseConsist from '../../../modules/vline/fleet-parser.mjs'

describe('The V/Line fleet parser', () => {
  it('Handles V/Locity numbers < 100', async () => {
    expect(parseConsist('V1142')).to.equal('VL42')
  })

  it('Handles V/Locity numbers >= 100', async () => {
    expect(parseConsist('V2103')).to.equal('V103')
  })

  it('Handles Sprinters', async () => {
    expect(parseConsist('S7001')).to.equal('7001')
  })

  it('Handles N-Class locomotives', async () => {
    expect(parseConsist('N452')).to.equal('N452')
  })

  it('Handles A-Class locomotives', async () => {
    expect(parseConsist('A62')).to.equal('A62')
  })

  it('Passes through anything unknown', async () => {
    expect(parseConsist('abcdef')).to.equal('abcdef')
  })
})