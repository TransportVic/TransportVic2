const async = require('async')
const utils = require('../../utils')

module.exports = async function(routeData, shapeData, routes, operator, mode, adjustRouteName=n => n, nameFilter=()=>true) {
  const allRoutes = routeData.map(values => {
    let adjustedRouteName = adjustRouteName(values[3])
    let shortRouteName = null

    if (adjustedRouteName instanceof Array) {
      shortRouteName = adjustedRouteName[1]
      adjustedRouteName = adjustedRouteName[0]
    }
    return {
      routeGTFSID: utils.simplifyRouteGTFSID(values[0]),
      routeName: adjustedRouteName,
      shortRouteName
    }
  })

  const mergedRoutes = {}

  allRoutes.forEach(route => {
    // console.log(route.routeName, route.shortRouteName, route.routeGTFSID)
    if (!nameFilter(route.routeName)) return
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

      if (route.shortRouteName) mergedRoutes[route.routeGTFSID].shortRouteName = route.shortRouteName
    } else {
      if (route.routeName.length > mergedRoutes[route.routeGTFSID].routeName.length) {
        mergedRoutes[route.routeGTFSID].routeName = route.routeName
        if (route.shortRouteName) mergedRoutes[route.routeGTFSID].shortRouteName = route.shortRouteName
      }
    }
  })

  await async.forEach(Object.values(mergedRoutes), async mergedRouteData => {
    await routes.replaceDocument({ routeName: mergedRouteData.routeName }, mergedRouteData, {
      upsert: true
    })
  })

  return Object.keys(mergedRoutes).length
}
