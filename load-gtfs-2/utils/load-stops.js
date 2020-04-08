const async = require('async')
const utils = require('../../utils')
const nameModifier = require('../../additional-data/bus-stop-name-modifier')

module.exports = async function(stops, data, stopsLookup) {
  await async.forEachSeries(data, async stop => {
    stop.fullStopName = nameModifier(stop.fullStopName)

    let datamartStop = stopsLookup[stop.stopGTFSID]
    if (!datamartStop) datamartStop = { mykiZones: [] }

    let mergeName = stop.fullStopName.split('/')[0]
    if (utils.isStreet(mergeName) || !mergeName.includes(' ')) {
      mergeName = stop.fullStopName
    }

    let matchingStop = await stops.findDocument({
      mergeName,
      location: {
        $nearSphere: {
          $geometry: stop.location,
          $maxDistance: 500
        }
      }
    })

    let actualMode = stop.mode === 'nbus' ? 'bus' : stop.mode
    let flags = null
    if (actualMode === 'bus') {
      flags = {
        isNightBus: stop.mode === 'nbus',
        hasRegularBus: stop.mode === 'bus'
      }
    }

    if (matchingStop) {
      let matchingBay = matchingStop.bays.find(bay => bay.stopGTFSID === stop.stopGTFSID && bay.mode === actualMode)

      if (matchingBay) {
        let index = matchingStop.bays.indexOf(matchingBay)

        matchingBay.originalName = stop.originalName
        matchingBay.fullStopName = stop.fullStopName
        matchingBay.location = stop.location
        matchingBay.mykiZones = datamartStop.mykiZones

        if (stop.mode === 'bus') {
          matchingBay.flags = {
            isNightBus: false,
            hasRegularBus: true
          }
        } else if (stop.mode === 'nbus') {
          matchingBay.flags.isNightBus = true
        }

        matchingStop.bays[index] = matchingBay
      } else {
        stop.mode = actualMode
        matchingStop.bays.push({
          ...stop,
          mykiZones: datamartStop.mykiZones,
          flags
        })
      }

      matchingStop.suburb = matchingStop.bays.map(bay => bay.suburb)
        .filter((e, i, a) => a.indexOf(e) === i)
      matchingStop.codedSuburb = matchingStop.suburb.map(suburb => utils.encodeName(suburb))
      matchingStop.codedNames = matchingStop.bays.map(bay => utils.encodeName(bay.fullStopName))
        .filter((e, i, a) => a.indexOf(e) === i)
      matchingStop.codedName = matchingStop.codedNames.sort((a, b) => a.length - b.length)[0]
      matchingStop.location = {
        type: 'MultiPoint',
        coordinates: matchingStop.bays.map(bay => bay.location.coordinates)
      }
      if (matchingStop.codedNames.length > 1) {
        matchingStop.stopName = matchingStop.mergeName
      }

      await stops.replaceDocument({
        _id: matchingStop._id
      }, matchingStop)
    } else {
      let stopData = {
        stopName: stop.fullStopName,
        suburb: [stop.suburb],
        codedSuburb: [utils.encodeName(stop.suburb)],
        codedName: utils.encodeName(stop.fullStopName),
        codedNames: [utils.encodeName(stop.fullStopName)],
        bays: [{
          ...stop,
          mykiZones: datamartStop.mykiZones,
          flags
        }],
        location: {
          type: 'MultiPoint',
          coordinates: [stop.location.coordinates]
        },
        mergeName,
        services: []
      }
      await stops.createDocument(stopData)
    }
  })
}
