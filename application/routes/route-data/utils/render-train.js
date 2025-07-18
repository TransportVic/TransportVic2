const utils = require('../../../../utils')
const routeUtils = require('./route-utils')
const stationCodes = require('../../../../additional-data/station-codes')

let stationCodeLookup = {}
Object.keys(stationCodes).forEach(code => stationCodeLookup[stationCodes[code]] = code)

async function render(params, res, matchingRoute) {
  let {db} = res
  let {routeNumber, directionName, suburb} = params

  let mode = matchingRoute.mode
  let niceMode = mode === 'regional train' ? 'vline' : 'metro'

  let gtfsTimetables = db.getCollection('gtfs timetables')

  let direction = matchingRoute.directions.find(direction => {
    return utils.encodeName(direction.directionName) === directionName
  })

  if (!direction) {
    return res.redirect(`/${niceMode}/line/${matchingRoute.cleanName}`)
  }

  let {gtfsDirection} = direction
  let fullDirectionName = direction.directionName

  let otherDirection = matchingRoute.directions.find(direction => {
    return direction.directionName !== fullDirectionName
  }) || direction

  let directionNames = [
    fullDirectionName,
    otherDirection.directionName
  ]

  let codedDirectionNames = directionNames.map(utils.encodeName)

  directionNames = directionNames.map(name => {
    if (name === 'Southern Cross Railway Station') return 'Melbourne'
    return name.replace(' Railway Station', '')
  })

  let cssName = niceMode === 'vline' ? 'vline' : `${matchingRoute.cleanName}-line`

  let query = {
    mode,
    routeGTFSID: matchingRoute.routeGTFSID,
    gtfsDirection: gtfsDirection.toString()
  }

  let firstLastTrainMap = await routeUtils.generateFirstLastTripMap(gtfsTimetables, query)
  let frequencyMap = await routeUtils.generateFrequencyMap(gtfsTimetables, query)

  let lineCode = stationCodeLookup[matchingRoute.routeName]
  if (matchingRoute.routeGTFSID === '14-XPT') lineCode = 'SYD'
  if (matchingRoute.routeGTFSID === '2-CCL') {
    cssName = 'city-circle'
    lineCode = 'CCL'
  }

  res.render('routes/train', {
    route: matchingRoute,
    lineCode,
    niceMode,
    direction,
    cssName,
    directionNames,
    codedDirectionNames,
    firstLastTrainMap,
    frequencyMap
  })
}

module.exports = render
