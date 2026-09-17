import { expect } from 'chai'
import { parseOccupancy, OCCUPANCY_STATUS } from '../../modules/new-tracker/gtfsr/parse-occupancy.mjs'

const TIMESTAMP = 1749891537000

describe('The GTFSR occupancy parser', () => {
  it('Maps the whole-vehicle occupancy status to a token', () => {
    expect(parseOccupancy({ occupancy_status: 3 }, TIMESTAMP)).to.deep.equal({
      timestamp: TIMESTAMP,
      status: 'standing-room-only'
    })
  })

  it('Carries through an occupancy percentage', () => {
    expect(parseOccupancy({ occupancy_status: 2, occupancy_percentage: 45 }, TIMESTAMP)).to.deep.equal({
      timestamp: TIMESTAMP,
      status: 'few-seats-available',
      percentage: 45
    })
  })

  it('Reports per-carriage occupancy in consist order', () => {
    let occupancy = parseOccupancy({
      occupancy_status: 3,
      multi_carriage_details: [
        { carriage_sequence: 2, occupancy_status: 5, occupancy_percentage: 90, label: 'B' },
        { carriage_sequence: 1, occupancy_status: 2, occupancy_percentage: 30, label: 'A' }
      ]
    }, TIMESTAMP)

    expect(occupancy.carriages).to.deep.equal([
      { sequence: 1, status: 'few-seats-available', percentage: 30, label: 'A' },
      { sequence: 2, status: 'full', percentage: 90, label: 'B' }
    ])
  })

  it('Treats a placeholder EMPTY status with no detail as no data', () => {
    // The VIC feed currently reports occupancy_status: 0 uniformly
    expect(parseOccupancy({ occupancy_status: 0 }, TIMESTAMP)).to.be.null
    expect(parseOccupancy({ occupancy_status: 0, occupancy_percentage: 0, multi_carriage_details: [] }, TIMESTAMP)).to.be.null
  })

  it('Reports a genuine EMPTY once a percentage or carriage detail confirms it', () => {
    let occupancy = parseOccupancy({
      occupancy_status: 0,
      multi_carriage_details: [{ carriage_sequence: 1, occupancy_status: 0 }]
    }, TIMESTAMP)

    expect(occupancy.status).to.equal('empty')
    expect(occupancy.carriages).to.deep.equal([{ sequence: 1, status: 'empty' }])
  })

  it('Treats NO_DATA_AVAILABLE as no status', () => {
    expect(OCCUPANCY_STATUS[7]).to.be.null
    expect(parseOccupancy({ occupancy_status: 7 }, TIMESTAMP)).to.be.null
  })

  it('Returns null when no occupancy fields are present', () => {
    expect(parseOccupancy({}, TIMESTAMP)).to.be.null
    expect(parseOccupancy(null, TIMESTAMP)).to.be.null
  })
})
