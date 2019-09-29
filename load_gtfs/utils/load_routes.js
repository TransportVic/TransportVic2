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
      fullGTFSID: values[0],
      routeName: adjustedRouteName,
      shortRouteName
    }
  })

  const mergedRoutes = {}

  allRoutes.forEach(route => {
    // console.log(route.routeName, route.shortRouteName, route.routeGTFSID)
    if (!nameFilter(route.routeName)) return
    if (!mergedRoutes[route.routeGTFSID]) {
      mergedRoutes[route.routeGTFSID] = {
        routeName: route.routeName,
        codedName: utils.encodeName(route.routeName),
        routeGTFSID: route.routeGTFSID,
        operators: operator(route.routeName),
        directions: [],
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
    let routeTypes = {}
    let routeLengths = {}
    let mergedRouteTypes = {}

    shapeData.filter(data => data[0].startsWith(mergedRouteData.routeGTFSID)).forEach(line => {
      if (!routeTypes[line[0]]) routeTypes[line[0]] = []
      routeTypes[line[0]].push(line)
    })

    Object.keys(routeTypes).forEach(routeGTFSID => {
      let shapeData = routeTypes[routeGTFSID].filter((line, i, a) => {
        if (a[i - 1])
          return a[i - 1][4] !== line[4]
        return true
      }).map(line => [line[2], line[1]])
      let routeLength = routeTypes[routeGTFSID].slice(-1)[0][4]
      routeTypes[routeGTFSID] = shapeData

      if (!routeLengths[routeLength])
        routeLengths[routeLength] = []

      routeLengths[routeLength].push(routeGTFSID)
    })

    Object.keys(routeLengths).forEach(length => {
      mergedRouteTypes[routeLengths[length].join(',')] = routeTypes[routeLengths[length][0]]
    })

    mergedRoutes[mergedRouteData.routeGTFSID].routePath = mergedRouteTypes

    await routes.replaceDocument({ routeName: mergedRouteData.routeName }, mergedRouteData, {
      upsert: true
    })
  })

  return Object.keys(mergedRoutes).length
}
