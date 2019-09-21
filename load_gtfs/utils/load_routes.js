const async = require('async')
const utils = require('../../utils')

module.exports = async function(routeData, shapeData, routes, operator, mode, adjustRouteName=n => n) {
  const allRoutes = routeData.map(values => {
    return {
      routeGTFSID: utils.simplifyRouteGTFSID(values[0]),
      routeName: adjustRouteName(values[3])
    }
  })

  const mergedRoutes = {}

  allRoutes.forEach(route => {
    if (!mergedRoutes[route.routeGTFSID]) {
      let routeShapeData = shapeData.filter(data => data[0].startsWith(route.routeGTFSID))
      .sort((a, b) => a[3] - b[3])

      const routeLength = routeShapeData.slice(-1)[0][4]
      routeShapeData = routeShapeData.map(data => [data[2], data[1]])

      mergedRoutes[route.routeGTFSID] = {
        routeName: route.routeName,
        codedName: utils.encodeName(route.routeName),
        routeGTFSID: route.routeGTFSID,
        routePath: {
          type: "LineString",
          coordinates: routeShapeData
        },
        routeLength: parseFloat(routeLength),
        operators: operator(route.routeName),
        stops: [],
        mode
      }
    } else {
      if (route.routeName.length > mergedRoutes[route.routeGTFSID].routeName.length)
        mergedRoutes[route.routeGTFSID].routeName = route.routeName
    }
  })

  await async.forEach(Object.values(mergedRoutes), async mergedRouteData => {
    await routes.replaceDocument({ routeName: mergedRouteData.routeName }, mergedRouteData, {
      upsert: true
    })
  })

  return Object.keys(mergedRoutes).length
}
