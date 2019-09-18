const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const stopsData = fs.readFileSync('gtfs/1/stops.txt').toString()
  .split('\r\n').slice(1).filter(Boolean).map(e => e.split(',').map(f => f.slice(1, -1)))
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let stops = null

database.connect({
  poolSize: 100
}, async err => {
  stops = database.getCollection('stops')
  stops.createIndex({
    'bays.location': '2dsphere',
    stopName: 1,
    fullStopName: 1,
    'bays.stopGTFSID': 1
  })

  const allStops = stopsData.map(values => {
    const stopNameData = values[1].match(/([^(]+) \((.+)+\)/)

    let fullStopName = utils.adjustStopname(stopNameData[1]),
        stopName = utils.extractStopName(fullStopName);

    return {
      fullStopName,
      stopName,
      stopGTFSID: values[0],
      suburb: stopNameData[2],
      codedName: utils.encodeName(stopName.slice(0, -16)),
      location: [values[3], values[2]].map(parseFloat)
    }
  });

  await async.forEach(allStops, async stop => {
    let bayData = {
      stopGTFSID: parseInt(stop.stopGTFSID),
      services: [],
      location: {
        type: 'Point',
        coordinates: stop.location
      },
      stopNumber: null,
      mode: 'regional train'
    };

    let stopData;
    if (stopData = await stops.findDocument({stopName: stop.stopName})) {
      let existingBay;
      if (existingBay = stopData.bays.filter(bay => bay.stopGTFSID == stop.stopGTFSID)[0]) {
        stopData.bays.splice(stopData.bays.indexOf(existingBay), 1)
      }
      stopData.bays.push(bayData);

      if (!stopData.suburb.includes(stop.suburb)) stopData.suburb.push(stop.suburb);

      await stops.updateDocument({stopName: stop.stopName}, {
        $set: stopData
      })
    } else {
      await stops.createDocument({
        fullStopName: stop.fullStopName,
        stopName: stop.stopName,
        suburb: [stop.suburb],
        codedName: stop.codedName,
        bays: [bayData]
      })
    }
  });

  console.log('Completed loading in ' + allStops.length + ' V/Line railway stations')
  process.exit()
});
