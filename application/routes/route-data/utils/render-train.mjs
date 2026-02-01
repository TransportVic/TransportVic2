import utils from '../../../../utils.mjs'
import routeUtils from './route-utils.mjs'
import stationCodes from '../../../../additional-data/station-codes.json' with { type: 'json' }

let stationCodeLookup = {}
Object.keys(stationCodes).forEach(code => stationCodeLookup[stationCodes[code]] = code)

export default async function render(params, res, matchingRoute) {
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
    gtfsDirection
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