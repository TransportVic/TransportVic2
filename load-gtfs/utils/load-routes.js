const async = require('async')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const gtfsModes = require('../gtfs-modes.json')
const loopDirections = require('../../additional-data/loop-direction')

module.exports = async function(routes, mode, routeData, shapeJSON, operator, name, routeNumber) {
  let routeOperatorsSeen = []
  let rawRouteNames = {}

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

  await async.forEachSeries(shapeJSON, async shapeFile => {
    let {shapeID, routeGTFSID} = shapeFile

    let matchingRoute = await routes.findDocument({
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
        matchingRoute.operators = operator ? operator(routeGTFSID, matchingRoute.routeNumber, matchingRoute.routeName) : []
        routeOperatorsSeen.push(routeGTFSID)
      }

      matchingRoute.routeName = routeName

      await routes.replaceDocument({
        _id: matchingRoute._id
      }, matchingRoute)
    } else {
      let gtfsRouteNumber = null
      if (['3', '4', '6', '8'].includes(mode)) { // tram, metro bus, regional bus, telebus, night bus
        gtfsRouteNumber = gtfsRouteData[2]
      } else if (mode === '7') {
        gtfsRouteNumber = routeGTFSID.slice(2)
      }

      let newRoute = {
        routeName,
        codedName: utils.encodeName(routeName),
        routeNumber: routeNumber ? routeNumber(routeGTFSID, gtfsRouteNumber) : gtfsRouteNumber,
        routeGTFSID,
        routePath: [{
          fullGTFSIDs: [shapeID],
          path: shapeFile.path,
          length: shapeFile.length
        }],
        operators: operator ? operator(routeGTFSID) : [],
        directions: [],
        mode: mode === '8' ? 'bus' : gtfsModes[mode]
      }

      if (loopDirections[routeGTFSID])
        newRoute.flags = loopDirections[routeGTFSID]

      await routes.createDocument(newRoute)
    }
  })
}
