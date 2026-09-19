import { expect } from 'chai'
import gtfsrFleet from './sample-data/gtfsr-fleet.json' with { type: 'json' }
import gtfsrFleetXT2 from './sample-data/gtfsr-fleet-xt2.json' with { type: 'json' }
import { getFleetData } from '../../../modules/new-tracker/metro/metro-gtfsr-fleet.mjs'

describe('The GTFSR Fleet Tracker module', () => {
  it('Should return the GTFSR data with just the consist numbers', async () => {
    let tripData = await getFleetData(() => gtfsrFleet)
    expect(tripData[0].operationDays).to.equal('20250614')
    expect(tripData[0].runID).to.equal('3312')
    expect(tripData[0].routeGTFSID).to.equal('2-LIL')

    expect(tripData[0].consist).to.deep.equal([
      [ '107M', '1354T', '108M' ],
      [ '247M', '1424T', '248M' ]
    ])
  })

  it('Processes XT2 data', async () => {
    let tripData = await getFleetData(() => gtfsrFleetXT2)
    expect(tripData[0].operationDays).to.equal('20250614')
    expect(tripData[0].runID).to.equal('3312')
    expect(tripData[0].routeGTFSID).to.equal('2-LIL')

    expect(tripData[0].consist).to.deep.equal([
      [ '8103', '8203', '8303', '8403', '8503', '8603' ]
    ])
  })

  it('Does not attach occupancy when the feed only reports placeholder zeros', async () => {
    let tripData = await getFleetData(() => gtfsrFleet)
    expect(tripData[0].occupancy).to.be.undefined
  })

  it('Attaches occupancy when the feed reports a load', async () => {
    let sample = JSON.parse(JSON.stringify(gtfsrFleet))
    sample.entity[0].vehicle.occupancy_status = 3
    sample.entity[0].vehicle.occupancy_percentage = 78

    let tripData = await getFleetData(() => sample)
    expect(tripData[0].occupancy.status).to.equal('standing-room-only')
    expect(tripData[0].occupancy.percentage).to.equal(78)
    expect(tripData[0].occupancy.timestamp).to.be.a('number')
  })
})
