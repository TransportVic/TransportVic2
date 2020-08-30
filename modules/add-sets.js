const async = require('async')
const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')
const sets = require('../additional-data/carriage-sets')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

function findSet(consist) {
  let carriages = consist.slice(1)
  let isH = !!carriages.find(x=>x.match(/B\w?H\d/))

  let match = Object.keys(sets).find(set => {
    let setCarriages = sets[set]
    let matched = setCarriages.filter(carriage => carriages.includes(carriage)).length
    if (isH) return matched >= 5
    else return matched >= 3
  })

  return match
}

database.connect(async () => {
  let vlineTrips = database.getCollection('vline trips')
  let allTrips = await vlineTrips.findDocuments({ consist: /N\d\d\d/ }).toArray()

  await async.forEach(allTrips, async trip => {
    let setNumber = findSet(trip.consist)
    if (!setNumber)
      console.log(trip.consist.slice(1), setNumber, sets[setNumber])

    // await vlineTrips.updateDocument({
    //   _id: trip._id
    // }, {
    //   $set: {
    //     consist: trip.consist
    //   }
    // })
  })

  console.log('Added sets to', allTrips.length, 'trips')
  process.exit()
})
