const utils = require('../../utils')
const async = require('async')

module.exports = async function (stopsData, stops, mode) {
  const allStops = stopsData.map(values => {
    const stopNameData = values[1].match(/([^(]+) \((.+)+\)/)

    let fullStopName = utils.adjustStopname(stopNameData[1]),
        stopName = utils.extractStopName(fullStopName);

    return {
      fullStopName,
      stopName,
      stopGTFSID: parseInt(values[0]),
      suburb: stopNameData[2],
      codedName: utils.encodeName(stopName.slice(0, -16)),
      location: [values[3], values[2]].map(parseFloat)
    }
  });

  await async.forEach(allStops, async stop => {
    let bayData = {
      fullStopName: stop.fullStopName,
      stopGTFSID: parseInt(stop.stopGTFSID),
      services: [],
      location: {
        type: 'Point',
        coordinates: stop.location
      },
      stopNumber: null,
      mode
    };

    let stopData;
    if (stopData = await stops.findDocument({stopName: stop.stopName})) {
      stopData.bays = stopData.bays.filter(bay => bay.stopGTFSID !== stop.stopGTFSID)
      stopData.bays.push(bayData);

      if (!stopData.suburb.includes(stop.suburb)) stopData.suburb.push(stop.suburb);

      await stops.updateDocument({stopName: stop.stopName}, {
        $set: stopData
      })
    } else {
      await stops.createDocument({
        stopName: stop.stopName,
        suburb: [stop.suburb],
        codedName: stop.codedName,
        bays: [bayData]
      })
    }
  });

  return allStops.length
}
