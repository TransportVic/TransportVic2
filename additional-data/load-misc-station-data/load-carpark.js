const fs = require('fs')
const carparkData = require('./carpark')

let stationData = {}

carparkData.features.forEach(feature => {
  let station = feature.properties.STATION
  let capacity = feature.properties.COM_CAPAC
  let geometry = feature.geometry

  if (!stationData[station]) stationData[station] = []
  stationData[station].push({
    capacity, geometry
  })
})

fs.writeFileSync(__dirname + '/../station-carparks.json', JSON.stringify(stationData, null, 0))
