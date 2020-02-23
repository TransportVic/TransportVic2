const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const async = require('async')

const fs = require('fs')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let start = new Date()

database.connect({}, async err => {
  let lgas = database.getCollection('lgas')
  lgas.createIndex({
    name: 1,
    id: 1
  }, {unique: true})
  lgas.createIndex({
    geometry: '2dsphere'
  })

  let i = 0

  let files = fs.readdirSync('./lga-data')
  await async.forEach(files, async fileName => {
    let lgaData = require('./lga-data/' + fileName)

    let lgaPolygons = {}
    let lgaIDs = {}

    await async.forEach(lgaData.features, async lga => {
      let key = Object.keys(lga.properties).find(k => k.includes('LGA') && k.endsWith('3'))
      let name = lga.properties[key]
      let id = lga.properties.LGA_PID

      if (name === 'UNINCORPORATED') return
      name = name.replace(' (UNINC)', '')

      let geometry = lga.geometry.coordinates

      if (!lgaPolygons[name]) {
        lgaPolygons[name] = []
        lgaIDs[name] = id
      }

      lgaPolygons[name].push(geometry)
    })
    await async.forEach(Object.keys(lgaPolygons), async name => {
      i++
      let id = lgaIDs[name]
      let polygons = lgaPolygons[name]

      let geometry = {
        type: 'MultiPolygon',
        coordinates: polygons
      }

      await lgas.replaceDocument({ name, id }, { name, id, geometry }, {
        upsert: true
      })
    })

    console.log('Completed loading LGAs from ' + fileName)
  })

  console.log('Completed loading ' + i + ' LGA boundaries')
  process.exit()
})
