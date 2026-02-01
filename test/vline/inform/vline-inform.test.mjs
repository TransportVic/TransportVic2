import { expect, use } from 'chai'
import utils from '../../../utils.mjs'
import { LokiDatabaseConnection } from '@transportme/database'
import { createAlert, matchService } from '../../../modules/vline/vline-inform.mjs'
import chaiExclude from 'chai-exclude'
import tdn8141 from './sample-data/tdn-8141.mjs'
import nsp8141 from './sample-data/nsp-8141.mjs'
import tdn8821 from './sample-data/tdn-8821.mjs'
import tdn8400 from './sample-data/tdn-8400.mjs'
import tdn8459 from './sample-data/tdn-8459.mjs'

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
    const liveTimetables = database.getCollection('live timetables')
    const vlineInform = database.getCollection('vline inform')
    await liveTimetables.createDocument(clone(tdn8141))
    await createAlert(database, emailPayload)

    const alert = await vlineInform.findDocument({})
    expect(alert).to.exist
    expect(alert).excluding('_id').excluding('meta').excluding('$loki').to.deep.equal({
      routeName: [ 'Ararat', 'Ballarat', 'Maryborough' ],
      active: true,
      acknowledged: false,

      fromDate: +utils.now() / 1000,
      // 15 minutes after the service ends
      toDate: +utils.parseTime('2025-11-23T07:00:00.000Z').add(15, 'minutes') / 1000,

      type: 'reduction',
      date: '20251123',
      runID: '8141',
      text: 'The 17:15 Southern Cross to Bacchus Marsh will run at a reduced capacity of 3 VLocity carriages.',
      specificData: [{
        carriages: 3,
        type: 'reduction'
      }]
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

  it('Matches trips after midnight', async () => {
    utils.now = () => utils.parseTime('2025-11-24T12:23:00.000Z') // 11.23pm

    const database = new LokiDatabaseConnection()
    const liveTimetables = database.getCollection('live timetables')
    await liveTimetables.createDocument(clone(tdn8821))

    const service = await matchService(database, {
      "departureTime": "01:15",
      "origin": "Southern Cross",
      "destination": "Waurn Ponds",
      "line": "Warrnambool",
      "matchedText": "01:15 Southern Cross to Waurn Ponds"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251124')
    expect(service.runID).to.equal('8821')
  })

  it('Uses the current PT day for trips departing after midnight when receving a message before 3am', async () => {
    utils.now = () => utils.parseTime('2025-11-24T15:23:00.000Z') // 20251125 2.23am

    const database = new LokiDatabaseConnection()
    const liveTimetables = database.getCollection('live timetables')
    await liveTimetables.createDocument(clone(tdn8821))

    const service = await matchService(database, {
      "departureTime": "01:15",
      "origin": "Southern Cross",
      "destination": "Waurn Ponds",
      "line": "Warrnambool",
      "matchedText": "01:15 Southern Cross to Waurn Ponds"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251124')
    expect(service.runID).to.equal('8821')
  })

  it('Uses the previous PT day for trips departing after midnight when receving a message after 3am but before 4am', async () => {
    utils.now = () => utils.parseTime('2025-11-24T16:23:00.000Z') // 20251125 3.23am

    const database = new LokiDatabaseConnection()
    const liveTimetables = database.getCollection('live timetables')
    await liveTimetables.createDocument(clone(tdn8821))

    const service = await matchService(database, {
      "departureTime": "01:15",
      "origin": "Southern Cross",
      "destination": "Waurn Ponds",
      "line": "Warrnambool",
      "matchedText": "01:15 Southern Cross to Waurn Ponds"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251124')
    expect(service.runID).to.equal('8821')
  })

  it('Uses the previous PT day for trips departing after 10pm but before midnight when receving a message after 3am but before 4am', async () => {
    utils.now = () => utils.parseTime('2025-11-20T16:23:00.000Z') // 20251121 3.23am

    const database = new LokiDatabaseConnection()
    const liveTimetables = database.getCollection('live timetables')
    await liveTimetables.createDocument(clone(tdn8459))

    const service = await matchService(database, {
      "departureTime": "23:59",
      "origin": "Southern Cross",
      "destination": "Traralgon",
      "line": "Gippsland",
      "matchedText": "23:30 Southern Cross to Traralgon"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251120')
    expect(service.runID).to.equal('8459')
  })

  it('Uses the following PT day for trips departing after 3am when receving a message before 3am', async () => {
    utils.now = () => utils.parseTime('2025-11-23T15:23:00.000Z') // 20251124 2.23am

    const database = new LokiDatabaseConnection()
    const liveTimetables = database.getCollection('live timetables')
    await liveTimetables.createDocument(clone(tdn8400))

    const service = await matchService(database, {
      "departureTime": "04:24",
      "origin": "Traralgon",
      "destination": "Southern Cross",
      "line": "Gippsland",
      "matchedText": "04:24 Traralgon to Southern Cross"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251124')
    expect(service.runID).to.equal('8400')
  })

  it('Uses the current PT day for trips departing after 3am when receving a message after 3am and before 4am', async () => {
    utils.now = () => utils.parseTime('2025-11-23T16:23:00.000Z') // 20251124 3.23am

    const database = new LokiDatabaseConnection()
    const liveTimetables = database.getCollection('live timetables')
    await liveTimetables.createDocument(clone(tdn8400))

    const service = await matchService(database, {
      "departureTime": "04:24",
      "origin": "Traralgon",
      "destination": "Southern Cross",
      "line": "Gippsland",
      "matchedText": "04:24 Traralgon to Southern Cross"
    })

    expect(service).to.exist
    expect(service.operationDays).to.equal('20251124')
    expect(service.runID).to.equal('8400')
  })

  afterEach(() => {
    utils.now = originalNow
  })
})