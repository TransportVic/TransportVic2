const async = require('async')
const utils = require('../../utils')

module.exports = async function(routeData, shapeData, routes, operator, mode) {
  const allRoutes = routeData.map(values => {
    return {
      routeGTFSID: values[0],
      routeName: values[3]
    }
  })

  const mergedRoutes = {}

  allRoutes.forEach(route => {
    if (!mergedRoutes[route.routeName]) {
      let routeShapeData = shapeData.filter(data => data[0].startsWith(route.routeGTFSID))
      .sort((a, b) => a[3] - b[3])

      const routeLength = routeShapeData.slice(-1)[0][4]
      routeShapeData = routeShapeData.map(data => [data[2], data[1]])

      mergedRoutes[route.routeName] = {
        routeName: route.routeName,
        codedName: utils.encodeName(route.routeName),
        routeGTFSIDs: [route.routeGTFSID],
        routePath: {
          type: "LineString",
          coordinates: routeShapeData
        },
        routeLength: parseFloat(routeLength),
        operators: operator(route.routeName),
        stops: [],
        mode: 'regional train'
      }
    } else {
      mergedRoutes[route.routeName].routeGTFSIDs.push(route.routeGTFSID)
    }
  })

  await async.forEach(Object.values(mergedRoutes), async mergedRouteData => {

    if (await routes.countDocuments({ routeName: mergedRouteData.routeName })) {
      await routes.updateDocument({ routeName: mergedRouteData.routeName }, {
        $set: mergedRouteData
      })
    } else {
      await routes.createDocument(mergedRouteData)
    }
  })

  return Object.keys(mergedRoutes).length
}
