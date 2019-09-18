const DatabaseConnection = require('../../database/DatabaseConnection')
const config = require('../../config.json')
const utils = require('../../utils')
const fs = require('fs')
const async = require('async')
const routeData = fs.readFileSync('gtfs/1/routes.txt').toString()
  .split('\r\n').slice(1).filter(Boolean).map(e => e.split(',').map(f => f.slice(1, -1)))
const shapeData = fs.readFileSync('gtfs/1/shapes.txt').toString()
  .split('\r\n').slice(1).filter(Boolean).map(e => e.split(',').map(f => f.slice(1, -1)))

const database = new DatabaseConnection(config.databaseURL, 'TransportVic2')
let routes = null

database.connect({
  poolSize: 100
}, async err => {
  routes = database.getCollection('routes')
  routes.createIndex({ routeName: 1 })

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
        operators: ['V/Line'],
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

  console.log('Completed loading in ' + Object.keys(mergedRoutes).length + ' V/Line routes')
  process.exit()
});
