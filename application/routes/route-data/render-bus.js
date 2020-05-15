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
  if (operator.includes('dysons')) operator = 'dysons'

  let query = {
    mode: 'bus',
    routeGTFSID: matchingRoute.routeGTFSID,
    gtfsDirection: gtfsDirection.toString()
  }

  let firstLastBusMap = await routeUtils.generateFirstLastBusMap(gtfsTimetables, query)
  let frequencyMap = await routeUtils.generateFrequencyMap(gtfsTimetables, query)

  let showDualTermini = true
  let {routeName} = matchingRoute
  let terminiName = routeName.replace(/\(Loop.*/, '').split(' - ')

  if (matchingRoute.directions.length === 1 && routeName.includes('Loop')) {
    if (terminiName[1]) {
      directionNames[0] = terminiName[1]
      if (matchingRoute.flags) {
        directionNames[0] += ` (${matchingRoute.flags[0]} Loop)`
      } else {
        directionNames[0] += ` (Loop)`
      }
    } else {
      showDualTermini = false
      directionNames[0] = matchingRoute.routeName
    }
  } else if (routeName.includes('Loop')) {
    directionNames[0] = terminiName[1]
    if (matchingRoute.flags) {
      directionNames[0] += ` (${matchingRoute.flags[direction.gtfsDirection]} Loop)`
    } else {
      directionNames[0] += ` (Loop)`
    }

    directionNames[1] = directionNames[1].replace(/ \(.+$/, '')
  } else if (routeName.includes('Town Service')) {
    showDualTermini = false
    directionNames[0] = matchingRoute.routeName
  }

  if (matchingRoute.operationDate) {
    let {operationDate} = matchingRoute
    directionNames[0] += ` (${operationDate.type[0].toUpperCase()}${operationDate.type.slice(1)} ${operationDate.operationDateReadable})`
  }


  res.render('routes/bus', {
    route: matchingRoute,
    showDualTermini,
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
