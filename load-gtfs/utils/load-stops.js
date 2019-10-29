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

module.exports = async function (stopsData, stops, mode, lookupTable, adjustStopName=_=>_, flagSetter=_=>null, isTram=false) {
  await stops.createIndex({
    'location': '2dsphere',
    stopName: 1,
    'bays.fullStopName': 1,
    'bays.stopGTFSID': 1,
    'bays.mode': 1
  }, {unique: true, name: 'stops index'})

  await stops.createIndex({
    'bays.stopGTFSID': 1,
    'bays.mode': 1
  }, {name: 'gtfs id/mode index'})

  await stops.createIndex({
    'bays.mode': 1
  }, {name: 'mode index'})
  await stops.createIndex({
    'bays.stopGTFSID': 1
  }, {name: 'gtfs id index'})

  await stops.createIndex({
    'suburb': 1,
    'stopName': 1
  }, {name: 'search index'})

  await stops.createIndex({
    'stopName': 1
  }, {name: 'stopName index'})
  await stops.createIndex({
    'mergeName': 1
  }, {name: 'mergeName index'})

  await stops.createIndex({
    'tramTrackerIDs': 1
  }, {name: 'tramtracker id index'})

  await stops.createIndex({
    'bays.flags.tramtrackerName': 1
  }, {name: 'tramtracker name index'})

  await stops.createIndex({
    'bays.stopNumber': 1
  }, {name: 'stop number index'})

  await stops.createIndex({
    'bays.routes': 1
  }, {name: 'routes index'})

  const allStops = stopsData.map(values => {
    let matchedStop = lookupTable[values[0]]
    let shouldOverride = !!matchedStop

    if (!shouldOverride) matchedStop = {
      stopName: values[1],
      mykiZones: []
    }
    let { mykiZones } = matchedStop

    if (!values[1].endsWith(')') && !matchedStop.stopName.endsWith(')'))
      matchedStop.stopName += ' (?)'
    let matchedStopName = utils.adjustRawStopName(matchedStop.stopName)
    let stopNameData = matchedStopName.match(/(.+) \((.+ \(.+\))\)$/)
    if (!stopNameData)
      stopNameData = matchedStopName.match(/(.+) \((.*?)\)$/)

    let gtfsStopName = utils.adjustRawStopName(values[1])
    let GTFSStopNameData = gtfsStopName.match(/(.+) \((.+ \(.+\))\)$/)
    if (!GTFSStopNameData)
      GTFSStopNameData = gtfsStopName.match(/(.+) \((.*?)\)$/)

    let fullStopName = adjustStopName(utils.adjustStopname((GTFSStopNameData || stopNameData)[1])),
        stopName = utils.extractStopName(fullStopName)

    let originalName = values[1]
    let stopNumber

    let parts
    if ((parts = stopName.match(/^(D?[\d]+[A-Za-z]?)-(.+)/)) || isTram) {
      if (!parts && stopName === 'Dandenong Rd') parts = [null, '48A', 'Dandenong Rd']
      if (!parts && stopName === 'Preston Depot') parts = [null, null, 'Preston Depot']
      stopNumber = parts[1]
      stopName = parts[2]
      fullStopName = fullStopName.replace(/^(D?[\d]+[A-Za-z]?)-/, '')
    }

    return {
      originalName, // used for merging purposes - dandenong (railway) station/foster station for eg
      fullStopName,
      stopName,
      stopGTFSID: parseInt(values[0]),
      suburb: shouldOverride ? stopNameData[2] : GTFSStopNameData[2],
      codedName: utils.encodeName(stopName),
      location: [values[3], values[2]].map(parseFloat),
      mykiZones,
      stopNumber
    }
  })

  let mergedStops = {}

  function getStopHashID(bayData, shortName) {
    let stopHash = createStopHash(bayData.fullStopName)
    if (utils.isStreet(shortName)) return stopHash

    let bayCoordinates = bayData.location.coordinates

    let mergeDistance = 200
    if (shortName.includes('Railway Station') || shortName.includes('SC') || mode === 'regional coach')
      mergeDistance = 400

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

  allStops.filter(Boolean).forEach(stop => {
    let bayData = {
      originalName: stop.originalName,
      fullStopName: stop.fullStopName,
      stopGTFSID: parseInt(stop.stopGTFSID),
      services: [],
      location: {
        type: 'Point',
        coordinates: stop.location
      },
      stopNumber: stop.stopNumber,
      mode,
      mykiZones: stop.mykiZones
    }

    let flags = flagSetter(stop.stopGTFSID, stop.fullStopName)
    if (flags) bayData.flags = flags

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
        bays: [bayData],
        mergeName: stop.stopName
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

    let key = {
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: stop.bays[0].location.coordinates
          },
          $maxDistance: 500
        }
      }
    }
    if (!utils.isStreet(stop.mergeName)) {
      key.mergeName = stop.mergeName
    } else {
      key.stopName = stop.stopName
    }

    let location = {
      type: "MultiPoint",
      coordinates: stop.bays.map(bay => bay.location.coordinates)
    }

    stop.codedSuburb = stop.suburb.map(utils.encodeName)
    stop.codedNames = stop.bays.map(bay => utils.encodeName(bay.fullStopName)).filter((e, i, a) => a.indexOf(e) === i)

    let stopData
    if (stopData = await stops.findDocument(key)) {
      let baysToUpdate = stop.bays.map(bay => bay.stopGTFSID)
      stopData.bays.forEach(bay => {
        if (!uniqueFullStopNames.includes(bay.fullStopName))
          uniqueFullStopNames.push(bay.fullStopName)
      })

      if (uniqueFullStopNames.length === 1) {
        stop.stopName = uniqueFullStopNames[0]
        stop.codedName = utils.encodeName(stop.stopName)
      } else {
        stop.stopName = stop.mergeName
        stop.codedName = utils.encodeName(stop.stopName)
      }

      let nightBusBays = stop.bays.filter(b => b.flags && b.flags.isNightBus)
      if (mode === 'bus' && nightBusBays.length) {
        let existingRegularBays = stopData.bays.filter(b => !b.flags || (b.flags && !b.flags.isNightBus && b.flags.hasRegularBus))
          .map(bay => bay.stopGTFSID)

        stop.bays = stop.bays.map(bay => {
          if (bay.flags && bay.flags.isNightBus) {
            bay.flags.hasRegularBus = existingRegularBays.includes(bay.stopGTFSID)
          }
          return bay
        })
      }

      stop.bays = stopData.bays
        .filter(bay => !(baysToUpdate.includes(bay.stopGTFSID) && bay.mode === mode))
        .concat(stop.bays)
      stop.codedNames = stop.bays.map(bay => utils.encodeName(bay.fullStopName)).filter((e, i, a) => a.indexOf(e) === i)

      stop.location = stopData.location

      let locationsSeen = []
      stop.location.coordinates = stop.location.coordinates.concat(location.coordinates)
        .filter(location => {
          let key = location[0] + '' + location[1]

          return locationsSeen.includes(key) ? false : locationsSeen.push(key) || true
        })

      stop.suburb = stopData.suburb.concat(stop.suburb).filter((e, i, a) => a.indexOf(e) === i)
      stop.codedSuburb = stop.suburb.map(utils.encodeName)

      await stops.updateDocument(key, {
        $set: stop
      })
    } else {
      stop.location = location
      await stops.createDocument(stop)
    }
  })

  return allStops.length
}
