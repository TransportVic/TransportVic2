import { expect } from 'chai'
import gtfsrFleet from './sample-data/gtfsr-fleet.json' with { type: 'json' }
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
})
