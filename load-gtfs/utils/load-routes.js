const async = require('async')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const gtfsModes = require('../gtfs-modes.json')
const loopDirections = require('../../additional-data/loop-direction')

module.exports = async function(routes, mode, routeData, shapeJSON, operator, name, routeNumber) {
  let routeOperatorsSeen = []
  let rawRouteNames = {}
  let routeDirectionCount = {}

  let routeGTFSIDsSeen = []

  routeData.forEach(line => {
    let routeGTFSID = gtfsUtils.simplifyRouteGTFSID(line[0])
    let rawRouteName = line[3]
    if (rawRouteNames[routeGTFSID]) {
      if (rawRouteNames[routeGTFSID].length < rawRouteName.length)
        rawRouteNames[routeGTFSID] = rawRouteName
    } else {
      rawRouteNames[routeGTFSID] = rawRouteName
    }
  })

  let routeGroups = {}
  shapeJSON.forEach(shapeFile => {
    let {routeGTFSID} = shapeFile
    if (!routeGroups[routeGTFSID]) routeGroups[routeGTFSID] = []
    routeGroups[routeGTFSID].push(shapeFile)
  })

  let routeCache = {}

  await async.forEach(Object.values(routeGroups), async routeGroup => {
    await async.forEachSeries(routeGroup, async shapeFile => {
      let {shapeID, routeGTFSID} = shapeFile

      if (!routeGTFSIDsSeen.includes(routeGTFSID))
        routeGTFSIDsSeen.push(routeGTFSID)

      let matchingRoute = routeCache[routeGTFSID] || await routes.findDocument({
        routeGTFSID
      })

      let gtfsRouteData = routeData.find(line => gtfsUtils.simplifyRouteGTFSID(line[0]) === routeGTFSID)

      let rawRouteName = rawRouteNames[routeGTFSID]

      let routeName = name ? name(gtfsRouteData[2], rawRouteName, routeGTFSID) : rawRouteName

      if (matchingRoute) {
        let getFingerprint = shape => `${shape.length}-${shape.path[0].join(',')}-${shape.path.slice(-1)[0].join(',')}`

        let shapeFingerprint = getFingerprint(shapeFile)
        let matchingPath = matchingRoute.routePath.find(path => shapeFingerprint === getFingerprint(path))
        if (matchingPath) {
          if (!matchingPath.fullGTFSIDs.includes(shapeID))
            matchingPath.fullGTFSIDs.push(shapeID)
        } else {
          matchingRoute.routePath.push({
            fullGTFSIDs: [shapeID],
            path: shapeFile.path,
            length: shapeFile.length
          })
        }

        if (!routeOperatorsSeen.includes(routeGTFSID)) {
          routeOperatorsSeen.push(routeGTFSID)
          matchingRoute.operators = operator ? operator(routeGTFSID, matchingRoute.routeNumber, matchingRoute.routeName) : []
        }

        matchingRoute.routeName = routeName
        matchingRoute.codedName = utils.encodeName(routeName)

        await routes.replaceDocument({
          _id: matchingRoute._id
        }, matchingRoute)

        routeCache[routeGTFSID] = matchingRoute
      } else {
        let gtfsRouteNumber = null
        if (['3', '4', '6', '8'].includes(mode)) { // tram, metro bus, regional bus, telebus, night bus
          gtfsRouteNumber = gtfsRouteData[2]
        } else if (mode === '7') {
          gtfsRouteNumber = routeGTFSID.slice(2)
        }

        let finalRouteNumber = routeNumber ? routeNumber(routeGTFSID, gtfsRouteNumber) : gtfsRouteNumber

        let newRoute = {
          routeName,
          codedName: utils.encodeName(routeName),
          routeNumber: finalRouteNumber,
          routeGTFSID,
          routePath: [{
            fullGTFSIDs: [shapeID],
            path: shapeFile.path,
            length: shapeFile.length
          }],
          operators: operator ? operator(routeGTFSID, finalRouteNumber, routeName) : [],
          directions: [],
          mode: mode === '8' ? 'bus' : gtfsModes[mode]
        }

        routeOperatorsSeen.push(routeGTFSID)

        if (loopDirections[routeGTFSID])
          newRoute.flags = loopDirections[routeGTFSID]

        await routes.createDocument(newRoute)

        routeCache[routeGTFSID] = newRoute
      }
    })
  })

  return routeGTFSIDsSeen
}
