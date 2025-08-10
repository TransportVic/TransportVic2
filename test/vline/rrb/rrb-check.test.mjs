import { expect } from 'chai'
import { LokiDatabaseConnection } from '@transportme/database'
import nsp from './sample-data/nsp.json' with { type: 'json' }
import rrbSameOrigin from './sample-data/rrb-same-origin.json' with { type: 'json' }
import rrbSecondStop from './sample-data/rrb-second-stop.json' with { type: 'json' }
import rrbSecondStopEarly from './sample-data/rrb-second-stop-early.json' with { type: 'json' }
import rrbPKM35L from './sample-data/rrb-pkm-35L.json' with { type: 'json' }
import rrbCheck from '../../../modules/regional-coach/rrb-check.js'
import utils from '../../../utils.js'

const clone = o => JSON.parse(JSON.stringify(o))

let database = new LokiDatabaseConnection()
let liveTimetables = database.getCollection('timetables')
await liveTimetables.createDocuments(clone(nsp))

describe('The V/Line RRB check function', () => {
  it('Matches coach departures with an identical NSP rail service', async () => {
    const nspTrip = await rrbCheck(rrbSameOrigin, utils.parseDate('20250810'), database)

    expect(nspTrip).to.exist
    expect(nspTrip.runID).to.equal('8461')
  })

  it('Matches coach departures departing from the second stop', async () => {
    const nspTrip = await rrbCheck(rrbSecondStop, utils.parseDate('20250810'), database)

    expect(nspTrip).to.exist
    expect(nspTrip.runID).to.equal('8463')
  })

  it('Matches coach departures departing from the second stop, allowing up to 20min for a long distance coach', async () => {
    const nspTrip = await rrbCheck(rrbSecondStopEarly, utils.parseDate('20250810'), database)

    expect(nspTrip).to.exist
    expect(nspTrip.runID).to.equal('8461')
  })

  it('Matches coach departures departing from outstations such as Pakenham, allowing up to 35min', async () => {
    const nspTrip = await rrbCheck(rrbPKM35L, utils.parseDate('20250810'), database)

    expect(nspTrip).to.exist
    expect(nspTrip.runID).to.equal('8461')
  })
})