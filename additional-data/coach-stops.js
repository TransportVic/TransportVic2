const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config')
const utils = require('../utils')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let overrides = {
  "Post Office/Great Ocean Road": "Airerys Inlet Post Office",
  "Angelsea Motor Inn/Great Ocean Road": "Angelsea Motor Inn",
  "Pisces Holiday Park/Great Ocean Road": "Apollo Bay Pisces Holiday Park",
  "Eastland SC/Warrandyte Road": "Eastland SC",
  "Golf Links Road/Great Ocean Road": "Eastern View Memorial Arch",
  "Moorabool Street/Malop Street": "Geelong City",
  "Hawdon Avenue/Great Ocean Road": "Kennett River Caravan Park",
  "General Store/Great Ocean Road": "Lavers Hill General Store",
  "McRae Road/Great Ocean Road": "Wye River General Store",
  "Surf Club/Tregea Street": "Port Campbell Surf Club",
  "Southern Cross Railway Station": "Southern Cross Railway Station",
  "Southern Cross Coach Terminal/Spencer Street": "Southern Cross Coach Terminal"
}

let stops = {}

let suburbOverride = {
  'Ballarat Central': 'Ballarat'
}

const isInTest = typeof global.it === 'function'
if (!isInTest) database.connect(async err => {
  let coachStops = await database.getCollection('stops').findDocuments({
    'bays.mode': 'regional coach'
  }).toArray()

  let added = []

  coachStops.forEach(stop => {
    stop.bays.forEach(bay => {
      if (!bay.mode === 'regional coach') return

      let suburb = bay.suburb
      let fullName = `${bay.fullStopName.replace('Shopping Centre', 'SC')} ${suburb}`
      let fullNameOverride = `${bay.fullStopName.replace('Shopping Centre', 'SC')}`

      if (overrides[fullNameOverride]) return stops[fullName] = overrides[fullNameOverride]

      let correctedSuburb = suburb.replace(/\: \d{4}/, '').replace(/, \w*$/, '').trim()
      stops[fullName] = suburbOverride[correctedSuburb] || correctedSuburb
    })
  })
})

module.exports = function (stop) {
  let stopName = stop.fullStopName || stop.stopName
  let fullName = `${stopName.replace('Shopping Centre', 'SC')} ${stop.suburb}`
  return stops[fullName] || stopName.replace(/Railway Station.*/, '')
}

module.exports.stops = stops
