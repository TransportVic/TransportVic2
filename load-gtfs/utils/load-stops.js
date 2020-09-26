const async = require('async')
const utils = require('../../utils')
const nameModifier = require('../../additional-data/bus-stop-name-modifier')
const natural = require('natural')
const metaphone = natural.Metaphone

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

    let actualMode = stop.mode === 'nbus' ? 'bus' : stop.mode
    let flags = null
    if (actualMode === 'bus') {
      flags = {
        isNightBus: stop.mode === 'nbus',
        hasRegularBus: stop.mode === 'bus'
      }
    } else if (actualMode === 'tram') {
      flags = {
        tramtrackerName: stop.fullStopName.split('/')[0],
        services: datamartStop.services
      }
    }

    if (matchingStop) {
      let matchingBay = matchingStop.bays.find(bay => bay.stopGTFSID === stop.stopGTFSID && bay.mode === actualMode)

      if (matchingBay) {
        let index = matchingStop.bays.indexOf(matchingBay)

        matchingBay.originalName = stop.originalName
        matchingBay.fullStopName = stop.fullStopName
        matchingBay.location = stop.location

        datamartStop.mykiZones.forEach(zone => {
          if (matchingBay.mykiZones.includes(zone)) {
            matchingBay.mykiZones.push(zone)
          }
        })

        matchingBay.mykiZones = matchingBay.mykiZones.sort((a, b) => a - b)

        if (stop.mode === 'bus') {
          matchingBay.flags = {
            isNightBus: false,
            hasRegularBus: true
          }
        } else if (stop.mode === 'nbus') {
          matchingBay.flags.isNightBus = true
        } else matchingBay.flags = flags

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
        let codedStopName = utils.encodeName(matchingStop.stopName)
        matchingStop.codedName = codedStopName

        if (!matchingStop.codedNames.includes(codedStopName))
          matchingStop.codedNames = [codedStopName, ...matchingStop.codedNames]
      }

      matchingStop.namePhonetic = metaphone.process(matchingStop.stopName)

      await stops.replaceDocument({
        _id: matchingStop._id
      }, matchingStop)
    } else {
      stop.mode = actualMode
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
        services: [],
        screenService: [],
        namePhonetic: metaphone.process(stop.fullStopName)
      }
      await stops.createDocument(stopData)
    }
  })
}
