const DatabaseConnection = require('../database/DatabaseConnection');
const config = require('../config.json');
const fs = require('fs');
const calendar = fs.readFileSync('gtfs/1/google_transit/calendar.txt').toString()
    .split('\r\n').slice(1).filter(Boolean).map(e => e.split(',').map(f => f.slice(1, -1)));
const tripsData = fs.readFileSync('gtfs/1/google_transit/trips.txt').toString()
    .split('\r\n').slice(1).filter(Boolean).map(e => e.split(',').map(f => f.slice(1, -1)));
const tripTimingData = fs.readFileSync('gtfs/1/google_transit/stop_times.txt').toString()
    .split('\r\n').slice(1).filter(Boolean).map(e => e.split(',').map(f => f.slice(1, -1)));

let database = new DatabaseConnection(config.databaseURL, 'TransportVic2');
let vlineRailTrips = null;

let calenderTypes = {};

calendar.forEach(type => {
    let typeID = type[0];
    let operatingDates =  type.slice(1, 8).map(e => e == 1);

    let startDate = new Date(type[8].replace(/(\d{4})(\d\d)(\d\d)/, '$1 $2 $3') + ' GMT+1000');
    let endDate = new Date(type[9].replace(/(\d{4})(\d\d)(\d\d)/, '$1 $2 $3') + ' GMT+1000');

    let daysOfOperation = [];
    for (let day = +startDate; day <= +endDate; day += 24 * 60 * 60 * 1000) {
        let dayOfWeek = new Date(day).getDay();
        if (--dayOfWeek == -1) dayOfWeek = 6;

        if (operatingDates[dayOfWeek]) { // service will run on that day
            daysOfOperation.push(day);
        }
    }

    calenderTypes[typeID] = daysOfOperation;
});

database.connect({
    poolSize: 100
}, (err) => {
    vlineRailTrips = database.getCollection('vline rail trips');
    vlineRailTrips.createIndex({ routeID: 1 });

    let routes = {};

    tripsData.forEach(tripData => {
        let routeID = tripData[0];
        if (!routes[routeID]) routes[routeID] = [];

        let timingData = tripTimingData.filter(data => data[0] == tripData[2]);
        timingData = timingData.sort((a, b) => a[4] - b[4]).map(stop => {
            return {
                arrivalTime: stop[1],
                departureTime: stop[2],
                gtfsStationID: stop[3],
                stopSequence: stop[4],
                pickupType: stop[6],
                dropoffType: stop[7],
                distance: stop[8]
            }
        })

        routes[routeID].push({
            daysOfOperation: calenderTypes[tripData[1]],
            tripID: tripData[2],
            shapeID: tripData[3],
            towards: tripData[4],
            timingData
        });
    });

    console.log(routes);

    let completedTrips = [];

    Object.keys(routes).forEach(routeID => {
        let trips = routes[routeID];
        trips.forEach(trip => {
            trip.routeID = routeID;

            completedTrips.push(new Promise(resolve => {
                vlineRailTrips.countDocuments({ tripID: trip.tripID }, (err, present) => {
                    if (present) {
                        vlineRailTrips.updateDocument({ tripID: trip.tripID }, {
                            $set: trip
                        }, resolve);
                    } else {
                        vlineRailTrips.createDocument(trip, resolve);
                    }
                });
            }));
        });
    });

    Promise.all(completedTrips).then(() => {
        console.log('Completed loading in ' + completedTrips.length + ' V/Line rail trips');
        process.exit();
    });
});
