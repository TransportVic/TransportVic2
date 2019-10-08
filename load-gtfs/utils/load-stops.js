const utils = require('../../utils')
const async = require('async')

module.exports = async function (stopsData, stops, mode, lookupTable) {
  const allStops = stopsData.map(values => {
    let matchedStop = lookupTable[values[0]]
    if (!matchedStop) matchedStop = {
      stopName: values[1] + ' (?)',
      mykiZones: []
    }
    let { mykiZones } = matchedStop

    const stopNameData = matchedStop.stopName.match(/([^(]+) \((.+)+\)/)

    let fullStopName = utils.adjustStopname(stopNameData[1]),
        stopName = utils.extractStopName(fullStopName);

    return {
      fullStopName,
      stopName,
      stopGTFSID: parseInt(values[0]),
      suburb: stopNameData[2],
      codedName: utils.encodeName(stopName),
      location: [values[3], values[2]].map(parseFloat),
      mykiZones
    }
  });

  let mergedStops = {}
  allStops.forEach(stop => {
    let bayData = {
      fullStopName: stop.fullStopName,
      stopGTFSID: parseInt(stop.stopGTFSID),
      services: [],
      location: {
        type: 'Point',
        coordinates: stop.location
      },
      stopNumber: null,
      mode,
      mykiZones: stop.mykiZones
    }

    if (mergedStops[stop.stopName]) {
      mergedStops[stop.stopName].bays = mergedStops[stop.stopName].bays.filter(bay =>
        !(bay.stopGTFSID === stop.stopGTFSID && bay.mode === mode))
      mergedStops[stop.stopName].bays.push(bayData)

      if (!mergedStops[stop.stopName].suburb.includes(stop.suburb))
        mergedStops[stop.stopName].suburb.push(stop.suburb);
    } else {
      mergedStops[stop.stopName] = {
        stopName: stop.stopName,
        suburb: [stop.suburb],
        codedName: stop.codedName,
        bays: [bayData]
      }
    }
  })

  await async.forEach(Object.values(mergedStops), async stop => {
    let stopData;
    if (stopData = await stops.findDocument({stopName: stop.stopName})) {
      let baysToUpdate = stop.bays.map(bay => bay.stopGTFSID)

      stop.bays = stopData.bays
        .filter(bay => !(baysToUpdate.includes(bay.stopGTFSID) && bay.mode === mode))
        .concat(stop.bays)

      await stops.updateDocument({stopName: stop.stopName}, {
        $set: stop
      })
    } else {
      await stops.createDocument(stop)
    }
  });

  return allStops.length
}
