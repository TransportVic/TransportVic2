const DatabaseConnection = require('./database/DatabaseConnection');
const config = require('./config.json');
let database = new DatabaseConnection(config.databaseURL, 'TransportVic2');
const vlineTimetable = require('./load_gtfs/load_vline_timetable');
const loki = require('lokijs');

let vnetDB = new loki('vnet.db');
let vnetTrips = vnetDB.addCollection('trips');

let total = 0;
let matched = 0;

let days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat']

database.connect({
    poolSize: 100
}, (err) => {
    setTimeout(() => {
        vlineRailTrips = database.getCollection('vline rail trips');

        vlineRailTrips.findDocuments({
            routeID: /1-V08-/
        }).toArray((err, trips) => {
            vlineTimetable('FP50 Eastern Weekday 220319 - Up').forEach(e => vnetTrips.insert(e));
            vlineTimetable('FP50 Eastern Weekday 220319 - Down').forEach(e => vnetTrips.insert(e));
            vlineTimetable('FP50 Eastern Saturday 220319 - Up').forEach(e => vnetTrips.insert(e));
            vlineTimetable('FP50 Eastern Saturday 220319 - Down').forEach(e => vnetTrips.insert(e));
            vlineTimetable('FP50 Eastern Sunday 220319 - Up').forEach(e => vnetTrips.insert(e));
            vlineTimetable('FP50 Eastern Sunday 220319 - Down').forEach(e => vnetTrips.insert(e));

            trips.forEach(trip => {
                total++;
                let firstStop = trip.timingData[0];
                let operationDays = trip.daysOfOperation.map(date => days[new Date(date).getDay()]).filter((e,i,a)=>a.indexOf(e)==i);

                let trips = vnetTrips.find({
                    $and: [{
                        stops: {
                            $elemMatch: {
                                "arrivalTime" : firstStop.arrivalTime.slice(0, -3),
                                "gtfsStationID" : firstStop.gtfsStationID
                            }
                        }
                    }].concat(operationDays.map(e => { operationDays: {$contains: e} }))
                });
                if (trips.length) matched++;
                else console.log(trip)
            });

            console.log(total, matched, matched / total * 100)
        });
    }, 60000);
});
