const request = require('request-promise')
const ptvAPI = require('../ptv-api')
const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const handleMTMSuspensions = require('./disruption-management/handle-mtm-suspensions')

let isOnline = true
var refreshRate = 10;
let currentDisruptions

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
database.connect((err) => {
  let liveTimetables = database.getCollection('live timetables')
  liveTimetables.createIndex({
    mode: 1,
    operator: 1,
    routeName: 1,
    operationDay: 1,
    origin: 1,
    destination: 1,
    departureTime: 1
  }, {unique: true})

  async function refreshCache() {
    try {
      const {status, disruptions} = await ptvAPI('/v3/disruptions')
      if (status.health === 0) throw new Error('')

      currentDisruptions = disruptions
      isOnline = true

      let mtmSuspensions = disruptions.metro_train.filter(disruption => disruption.disruption_type.toLowerCase().includes('suspended'))
      if (mtmSuspensions.length) handleMTMSuspensions(mtmSuspensions, database)
      else await liveTimetables.deleteDocuments({})
    } catch (e) {
      console.log('Failed to pass health check, running offline')
      isOnline = false
    }
  }

  setInterval(refreshCache, refreshRate * 60 * 1000);
  refreshCache();
})

module.exports = {
  isOnline: () => isOnline,
  getDisruptions: () => currentDisruptions
}
