import { expect, use } from 'chai'
import utils from '../../../utils.js'
import { LokiDatabaseConnection } from '@transportme/database'
import { createAlert, matchService } from '../../../modules/vline/vline-inform.mjs'
import chaiExclude from 'chai-exclude'
import tdn8141 from './sample-data/tdn-8141.mjs'
import nsp8141 from './sample-data/nsp-8141.mjs'

use(chaiExclude)

const clone = o => JSON.parse(JSON.stringify(o))

const emailPayload = {
  Subject: 'Service Reduction - Ballarat Line',
  'stripped-text': 'The 17:15 Southern Cross - Bacchus Marsh service will run at a reduced capacity of 3 VLocity carriages.'
}

describe('The V/Line inform module', () => {
  let originalNow
  before(() => {
    originalNow = utils.now
  })

  it('Processes and creates an alert for an email', async () => {
    utils.now = () => utils.parseTime('2025-11-23T05:52:37.000Z')

    const database = new LokiDatabaseConnection()
    const vlineInform = database.getCollection('vline inform')
    await createAlert(database, emailPayload)

    const alert = await vlineInform.findDocument({})
    expect(alert).excluding('_id').excluding('meta').excluding('$loki').to.deep.equal({
      routeName: [ 'Ararat', 'Ballarat', 'Maryborough' ],
      fromDate: +utils.now() / 1000,
      // 15 minutes after the service ends
      toDate: +utils.parseTime('2025-11-23T07:00:00.000Z').add(15, 'minutes') / 1000,
      type: 'reduction',
      active: true,
      acknowledged: false
    })
  })

  it('Matches the service data to a trip', async () => {
    utils.now = () => utils.parseTime('2025-11-23T05:52:37.000Z')

    const database = new LokiDatabaseConnection()
    const liveTimetables = database.getCollection('live timetables')
    await liveTimetables.createDocument(clone(tdn8141))

    const service = await matchService(database, {
      "departureTime": "17:15",
      "origin": "Southern Cross",
      "destination": "Bacchus Marsh",
      "line": "Ararat",
      "matchedText": "17:15 Southern Cross to Bacchus Marsh"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251123')
    expect(service.runID).to.equal('8141')
  })

  it('Matches the service data using the NSP if unable to match the live trip', async () => {
    utils.now = () => utils.parseTime('2025-11-23T05:52:37.000Z')

    const database = new LokiDatabaseConnection()
    const timetables = database.getCollection('timetables')
    const liveTimetables = database.getCollection('live timetables')
    await timetables.createDocument(clone(nsp8141))
    await liveTimetables.createDocument(clone(tdn8141))

    const service = await matchService(database, {
      "departureTime": "17:15",
      "origin": "Southern Cross",
      "destination": "Wendouree",
      "line": "Ararat",
      "matchedText": "17:15 Southern Cross to Wendouree"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251123')
    expect(service.runID).to.equal('8141')
  })

  afterEach(() => {
    utils.now = originalNow
  })
})