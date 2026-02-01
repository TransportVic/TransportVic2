import utils from '../../../../utils.mjs'
import routeUtils from './route-utils.mjs'

export default async function render(params, res, matchingRoute) {
  let {db} = res
  let {routeNumber, directionName, suburb} = params

  let gtfsTimetables = db.getCollection('gtfs timetables')

  let direction = matchingRoute.directions.find(direction => {
    return utils.encodeName(direction.directionName) === directionName
  })

  if (!direction) {
    if (matchingRoute.routeNumber) {
      if (matchingRoute.routeGTFSID.match(/(4|7|8)-/))
        return res.redirect(`/bus/route/${routeNumber}`)
      else
        return res.redirect(`/bus/route/regional/${suburb}/${routeNumber}`)
    } else
      return res.redirect(`/bus/route/named/${utils.encodeName(matchingRoute.routeName)}`)
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
    gtfsDirection
  }

  let firstLastBusMap = await routeUtils.generateFirstLastTripMap(gtfsTimetables, query)
  let frequencyMap = await routeUtils.generateFrequencyMap(gtfsTimetables, query)

  let showDualTermini = true
  let {routeName} = matchingRoute
  let terminiName = routeName.replace(/\(.*/, '').split(' - ')

  if (routeName.includes('Town Service')) {
    showDualTermini = false
    directionNames[0] = matchingRoute.routeName
  } else if (routeName.includes('Flexiride')) {
    showDualTermini = false
    directionNames[0] = matchingRoute.routeName
  } else if (matchingRoute.directions.length === 1) {
    if (routeName.includes('Loop')) {
      if (terminiName[1]) {
        directionNames[0] = terminiName[1]
        directionNames[1] = terminiName[0]
        if (matchingRoute.flags) {
          directionNames[0] += ` (${matchingRoute.flags[0]} Loop)`
        } else {
          directionNames[0] += ` (Loop)`
        }
      } else {
        showDualTermini = false
        directionNames[0] = matchingRoute.routeName
      }
    } else {
      directionNames = [terminiName[1], terminiName[0]]
    }
  } else if (routeName.includes('Loop')) {
    directionNames[0] = terminiName[1]
    if (matchingRoute.flags) {
      directionNames[0] += ` (${matchingRoute.flags[direction.gtfsDirection]} Loop)`
    } else {
      directionNames[0] += ` (Loop)`
    }

    directionNames[1] = directionNames[1].replace(/ \(.+$/, '')
  }

  let operationDateText
  if (matchingRoute.operationDate) {
    let {operationDate} = matchingRoute
    operationDateText = `${operationDate.type[0].toUpperCase()}${operationDate.type.slice(1)} ${operationDate.operationDateReadable}`
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
    operationDate: operationDateText,
    useStopNumbers: false
  })
}