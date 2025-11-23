import { expect, use } from 'chai'
import utils from '../../../utils.js'
import { LokiDatabaseConnection } from '@transportme/database'
import { createAlert } from '../../../modules/vline/vline-inform.mjs'
import chaiExclude from 'chai-exclude'

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

  it.only('Processes and creates an alert for an email', async () => {
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

  afterEach(() => {
    utils.now = originalNow
  })
})