const async = require('async')

const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

const stopNumbers = require('./788-stop-numbers')

database.connect({
  poolSize: 100
}, async err => {
  let stops = database.getCollection('gtfs-stops')

  await async.forEachLimit(Object.keys(stopNumbers), 20, async stopGTFSID => {
    let stopData = await stops.findDocument({ 'bays.stopGTFSID': stopGTFSID })
    let bay = stopData.bays.find(bay => bay.mode === 'bus' && bay.stopGTFSID === stopGTFSID)
    bay.stopNumber = stopNumbers[stopGTFSID]

    await stops.replaceDocument({
      _id: stopData._id
    }, stopData)
  })

  let stopCount = Object.keys(stopNumbers).length

  console.log('Completed updating ' + stopCount + ' bus stop numbers for 788')
  process.exit()
})
