import utils from '../../../../utils.mjs'
import routeUtils from './route-utils.mjs'

export default async function render(params, res, matchingRoute) {
  let {db} = res
  let {routeNumber, directionName} = params

  let gtfsTimetables = db.getCollection('gtfs timetables')

  let direction = matchingRoute.directions.find(direction => {
    return utils.encodeName(direction.directionName) === directionName
  })

  if (!direction) {
    return res.redirect(`/tram/route/${routeNumber}`)
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

  let query = {
    mode: 'tram',
    routeGTFSID: matchingRoute.routeGTFSID,
    gtfsDirection
  }

  let firstLastTramMap = await routeUtils.generateFirstLastTripMap(gtfsTimetables, query)
  let frequencyMap = await routeUtils.generateFrequencyMap(gtfsTimetables, query)

  let showDualTermini = true
  let {routeName} = matchingRoute
  let terminiName = routeName.replace(/\(.*/, '').split(' - ')

  if (matchingRoute.routeGTFSID === '3-35') {
    showDualTermini = false
    directionNames[0] = `City Circle Tram (${gtfsDirection === '0' ? 'Anti-Clockwise' : 'Clockwise'})`
  }

  res.render('routes/tram', {
    route: matchingRoute,
    showDualTermini,
    direction,
    directionNames,
    codedDirectionNames,
    firstLastTramMap,
    frequencyMap
  })
}