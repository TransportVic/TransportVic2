const async = require('async')
const utils = require('../../utils')
const gtfsUtils = require('../../gtfs-utils')
const gtfsModes = require('../gtfs-modes.json')

module.exports = async function(routes, mode, routeData, shapeJSON, operator, name) {
  await async.forEachSeries(shapeJSON, async shapeFile => {
    let {shapeID, routeGTFSID} = shapeFile

    let matchingRoute = await routes.findDocument({
      routeGTFSID
    })

    if (matchingRoute) {
      let shapeFingerprint = `${shapeFile.length}-${shapeFile.path[0].join(',')}`
      let matchingPath = matchingRoute.routePath.find(path => shapeFingerprint === `${path.length}-${path.path[0].join(',')}`)
      if (matchingPath) {
        let pathIndex = matchingRoute.routePath.indexOf(matchingPath)
        matchingPath.fullGTFSIDs.push(shapeID)
        matchingRoute.routePath[pathIndex] = matchingPath
      } else {
        matchingRoute.routePath.push({
          fullGTFSIDs: [shapeID],
          path: shapeFile.path,
          length: shapeFile.length
        })
      }

      matchingRoute.operators = operator ? operator(routeGTFSID) : []

      await routes.replaceDocument({
        _id: matchingRoute._id
      }, matchingRoute)
    } else {
      let gtfsRouteData = routeData.find(line => gtfsUtils.simplifyRouteGTFSID(line[0]) === routeGTFSID)
      let routeName = name ? name(gtfsRouteData[2], gtfsRouteData[3], gtfsUtils.simplifyRouteGTFSID(gtfsRouteData[1])) : gtfsRouteData[3]
      let routeNumber = null
      if (['4', '6', '7', '8'].includes(mode)) { // metro bus, regional bus, telebus, night bus
        routeNumber = gtfsRouteData[2]
      }

      let newRoute = {
        routeName,
        codedName: utils.encodeName(routeName),
        routeNumber,
        routeGTFSID,
        routePath: [{
          fullGTFSIDs: [shapeID],
          path: shapeFile.path,
          length: shapeFile.length
        }],
        operators: operator ? operator(routeGTFSID) : [],
        directions: [],
        mode: gtfsModes[mode]
      }

      await routes.createDocument(newRoute)
    }
  })
}
