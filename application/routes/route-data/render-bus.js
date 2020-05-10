const utils = require('../../../utils')
const routeUtils = require('./route-utils')

async function render(params, res, matchingRoute) {
  let {db} = res
  let {routeNumber, directionName, lga} = params

  let gtfsTimetables = db.getCollection('gtfs timetables')

  let direction = matchingRoute.directions.find(direction => {
    return utils.encodeName(direction.directionName) === directionName
  })

  if (!direction) {
    if (matchingRoute.routeGTFSID.match(/(4|7|8)-/))
      return res.redirect(`/bus/route/${routeNumber}`)
    else
      return res.redirect(`/bus/route/regional/${lga}/${routeNumber}`)
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

  let operator = utils.encodeName(matchingRoute.operators[0])

  let query = {
    mode: 'bus',
    routeGTFSID: matchingRoute.routeGTFSID,
    gtfsDirection: gtfsDirection.toString()
  }

  let firstLastBusMap = await routeUtils.generateFirstLastBusMap(gtfsTimetables, query)
  let frequencyMap = await routeUtils.generateFrequencyMap(gtfsTimetables, query)

  res.render('routes/bus', {
    route: matchingRoute,
    direction,
    operator,
    directionNames,
    codedDirectionNames,
    firstLastBusMap,
    frequencyMap,
    useStopNumbers: false
  })
}

module.exports = render
