const utils = require('../../utils')
const async = require('async')
const crypto = require('crypto')

function createStopHash(stopName) {
    let hash = crypto.createHash('sha1')
    hash.update(stopName)
    return hash.digest('hex').slice(0, 6)
}

function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
  var R = 6371 // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1)  // deg2rad below
  var dLon = deg2rad(lon2-lon1)
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)

  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  var d = R * c // Distance in km
  return Math.floor(d * 1000) // distance in m
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

module.exports = async function (stopsData, stops, mode, lookupTable, adjustStopName=_=>_) {
  const allStops = stopsData.map(values => {
    let matchedStop = lookupTable[values[0]]
    let shouldOverride = !!matchedStop

    if (!shouldOverride) matchedStop = {
      stopName: values[1] + ' (?)',
      mykiZones: []
    }
    let { mykiZones } = matchedStop

    const stopNameData = utils.adjustRawStopName(matchedStop.stopName).match(/([^(]*?) \((.*?)\)$/)
    const GTFSStopNameData = utils.adjustRawStopName(values[1]).match(/([^(]*?) \((.*?)\)$/)

    let fullStopName = adjustStopName(utils.adjustStopname((GTFSStopNameData || stopNameData)[1])),
        stopName = utils.extractStopName(fullStopName)

    let originalName = values[1]

    return {
      originalName, // used for merging purposes - dandenong (railway) station/foster station for eg
      fullStopName,
      stopName,
      stopGTFSID: parseInt(values[0]),
      suburb: shouldOverride ? stopNameData[2] : GTFSStopNameData[2],
      codedName: utils.encodeName(stopName),
      location: [values[3], values[2]].map(parseFloat),
      mykiZones
    }
  })

  let mergedStops = {}

  function canMerge(shortName) {
    return !(shortName.endsWith('St') || shortName.endsWith('Rd')
      || shortName.endsWith('Pde') || shortName.endsWith('Cl')
      || shortName.endsWith('Dr') || shortName.endsWith('Ave')
      || shortName.endsWith('Gr') || shortName.endsWith('Ct')
      || shortName.endsWith('Hwy') || shortName.endsWith('Tce')
      || shortName.endsWith('Wat') || shortName.endsWith('Cl')
      || shortName.endsWith('Crst') || shortName.endsWith('Pl')
      || shortName.endsWith('Bvd') || shortName.endsWith('Cres'))
  }

  function getStopHashID(bayData, shortName) {
    let stopHash = createStopHash(bayData.fullStopName)
    if (!canMerge(shortName)) return stopHash

    let bayCoordinates = bayData.location.coordinates

    let mergeDistance = 200
    if (mode === 'regional coach')
      mergeDistance = 400
    else if (shortName.includes('Railway Station') || shortName.includes('SC'))
      mergeDistance = 350

    let checkStop
    if (!!(checkStop = mergedStops[stopHash])) {
      let checkCoordinates = checkStop.bays[0].location.coordinates

      let stopDistance = getDistanceFromLatLon(
        bayCoordinates[1], bayCoordinates[0],
        checkCoordinates[1], checkCoordinates[0]
      )
      if (stopDistance < mergeDistance) {
        return stopHash
      }
    }

    for (let checkStopHash of Object.keys(mergedStops)) {
      let stop = mergedStops[checkStopHash]
      if (stop.stopName !== shortName) continue

      for (let bay of stop.bays) {
        let checkCoordinates = bay.location.coordinates

        let stopDistance = getDistanceFromLatLon(
          bayCoordinates[1], bayCoordinates[0],
          checkCoordinates[1], checkCoordinates[0]
        )

        if (stopDistance < mergeDistance) return checkStopHash
      }
    }

    return stopHash
  }

  allStops.forEach(stop => {
    let bayData = {
      originalName: stop.originalName,
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

    let stopHash = getStopHashID(bayData, stop.stopName)

    if (mergedStops[stopHash]) {
      mergedStops[stopHash].bays = mergedStops[stopHash].bays.filter(bay =>
        !(bay.stopGTFSID === stop.stopGTFSID && bay.mode === mode))
      mergedStops[stopHash].bays.push(bayData)

      if (!mergedStops[stopHash].suburb.includes(stop.suburb))
        mergedStops[stopHash].suburb.push(stop.suburb)
    } else {
      mergedStops[stopHash] = {
        stopName: stop.stopName,
        suburb: [stop.suburb],
        codedName: stop.codedName,
        bays: [bayData]
      }
    }
  })

  await async.forEachSeries(Object.values(mergedStops), async stop => {
    let uniqueFullStopNames = []
    stop.bays.forEach(bay => {
      if (!uniqueFullStopNames.includes(bay.fullStopName))
        uniqueFullStopNames.push(bay.fullStopName)
    })

    if (uniqueFullStopNames.length === 1) {
      stop.stopName = uniqueFullStopNames[0]
      stop.codedName = utils.encodeName(stop.stopName)
    }

    let key = { stopName: stop.stopName, suburb: {$in: stop.suburb} }

    let stopData
    if (stopData = await stops.findDocument(key)) {
      let baysToUpdate = stop.bays.map(bay => bay.stopGTFSID)

      stop.bays = stopData.bays
        .filter(bay => !(baysToUpdate.includes(bay.stopGTFSID) && bay.mode === mode))
        .concat(stop.bays)

      stop.suburb = stopData.suburb.concat(stop.suburb).filter((e, i, a) => a.indexOf(e) === i)

      await stops.updateDocument(key, {
        $set: stop
      })
    } else {
      await stops.createDocument(stop)
    }
  })

  return allStops.length
}
