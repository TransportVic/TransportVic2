const async = require('async')
const utils = require('../../utils')
const nameModifier = require('../../additional-data/stop-name-modifier')

module.exports = async function(stops, data, stopsLookup) {
  await async.forEachSeries(data, async stop => {
    stop.fullStopName = nameModifier(stop.fullStopName)

    let datamartStop = stopsLookup[stop.stopGTFSID]
    if (!datamartStop) datamartStop = { mykiZones: [], services: [] }

    let mergeName = utils.getStopName(stop.fullStopName)
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

    if (!matchingStop) {
      matchingStop = await stops.findDocument({
        'bays.originalName': stop.originalName
      })
    }

    let mode = stop.mode

    if (matchingStop) {
      let matchingBay = matchingStop.bays.find(bay => bay.stopGTFSID === stop.stopGTFSID && bay.mode === mode)

      if (matchingBay) {
        let index = matchingStop.bays.indexOf(matchingBay)

        matchingBay.originalName = stop.originalName
        matchingBay.fullStopName = stop.fullStopName
        matchingBay.location = stop.location

        datamartStop.mykiZones.forEach(zone => {
          if (!matchingBay.mykiZones.includes(zone)) {
            matchingBay.mykiZones.push(zone)
          }
        })

        matchingBay.mykiZones = matchingBay.mykiZones.sort((a, b) => a - b)

        matchingStop.bays[index] = matchingBay
      } else {
        matchingStop.bays.push({
          ...stop,
          mykiZones: datamartStop.mykiZones
        })
      }

      matchingStop.suburb = matchingStop.bays.map(bay => bay.suburb)
        .filter((e, i, a) => a.indexOf(e) === i)
      matchingStop.cleanSuburbs = matchingStop.suburb.map(suburb => utils.encodeName(suburb))
      matchingStop.codedNames = matchingStop.bays.map(bay => utils.encodeName(bay.fullStopName))
        .filter((e, i, a) => a.indexOf(e) === i)
      matchingStop.codedName = matchingStop.codedNames.sort((a, b) => a.length - b.length)[0]
      matchingStop.location = {
        type: 'MultiPoint',
        coordinates: matchingStop.bays.map(bay => bay.location.coordinates)
      }
      if (matchingStop.codedNames.length > 1) {
        matchingStop.stopName = matchingStop.mergeName
        let codedStopName = utils.encodeName(matchingStop.stopName)
        matchingStop.codedName = codedStopName

        if (!matchingStop.codedNames.includes(codedStopName))
          matchingStop.codedNames = [codedStopName, ...matchingStop.codedNames]
      }

      await stops.replaceDocument({
        _id: matchingStop._id
      }, matchingStop)
    } else {
      let stopData = {
        stopName: stop.fullStopName,
        suburb: [stop.suburb],
        cleanSuburbs: [utils.encodeName(stop.suburb)],
        codedName: utils.encodeName(stop.fullStopName),
        codedNames: [utils.encodeName(stop.fullStopName)],
        bays: [{
          ...stop,
          mykiZones: datamartStop.mykiZones
        }],
        location: {
          type: 'MultiPoint',
          coordinates: [stop.location.coordinates]
        },
        mergeName,
        services: [],
        screenService: []
      }
      await stops.createDocument(stopData)
    }
  })
}
