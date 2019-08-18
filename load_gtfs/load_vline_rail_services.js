const DatabaseConnection = require('../database/DatabaseConnection');
const config = require('../config.json');
const fs = require('fs');
const async = require('async');
const routeData = fs.readFileSync('gtfs/1/google_transit/routes.txt').toString();
const shapeData = fs.readFileSync('gtfs/1/google_transit/shapes.txt').toString()
    .split('\r\n').slice(1).filter(Boolean).map(e => e.split(',').map(f => f.slice(1, -1)));

let database = new DatabaseConnection(config.databaseURL, 'TransportVic2');
let vlineRailRoutes = null;

database.connect({
    poolSize: 100
}, async err => {
    vlineRailRoutes = database.getCollection('vline rail routes');
    vlineRailRoutes.createIndex({ serviceName: 1 });

    let allRoutes = routeData.split('\r\n').slice(1).filter(Boolean).map(e => {
        let values = e.split(',').map(f => f.slice(1, -1));

        return {
            gtfsRouteID: values[0],
            routeName: values[3]
        };
    });

    let mergedRoutes = {};

    allRoutes.forEach(route => {
        if (!mergedRoutes[route.routeName])
            mergedRoutes[route.routeName] = {};

        let routeShapeData = shapeData.filter(data => data[0].startsWith(route.gtfsRouteID))
            .sort((a, b) => a[3] - b[3]);

        let routeLength = routeShapeData.slice(-1)[0][4];
        routeShapeData = routeShapeData.map(data => [data[2], data[1]]);

        mergedRoutes[route.routeName][route.gtfsRouteID] = {
            shape: routeShapeData,
            routeLength
        };
    });

    await new Promise(r => async.map(Object.keys(mergedRoutes), async routeName => {
        let combinedRouteData = mergedRoutes[routeName];

        let route = {
            routeName,
            gtfsRouteIDs: Object.keys(combinedRouteData),
            variants: combinedRouteData
        };

        if (await vlineRailRoutes.countDocuments({ routeName })) {
            await vlineRailRoutes.updateDocument({ routeName }, {
                $set: route
            });
        } else {
            await vlineRailRoutes.createDocument(route);
        }
    }, r));

    console.log('Completed loading in ' + Object.keys(mergedRoutes).length + ' V/Line routes');
    process.exit();
});
