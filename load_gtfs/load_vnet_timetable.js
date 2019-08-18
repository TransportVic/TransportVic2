const DatabaseConnection = require('../database/DatabaseConnection');
const config = require('../config.json');
let database = new DatabaseConnection(config.databaseURL, 'TransportVic2');
let vlineRailwayStations = null;
let vnetTimetables = null;

const fs = require('fs');
const parseCSV = require('csv-parse');
const async = require('async');

let files = [
    'FP50 Eastern Weekday 220319 - Up',
    'FP50 Eastern Weekday 220319 - Down',
    'FP50 Eastern Saturday 220319 - Up',
    'FP50 Eastern Saturday 220319 - Down',
    'FP50 Eastern Sunday 220319 - Up',
    'FP50 Eastern Sunday 220319 - Down',

    'FP50 NESG All Days 220319 - Up',
    'FP50 NESG All Days 220319 - Down',

    'FP50 North Eastern Weekday 220319 - Up',
    'FP50 North Eastern Weekday 220319 - Down',
    'FP50 North Eastern Saturday 220319 - Up',
    'FP50 North Eastern Saturday 220319 - Down',
    'FP50 North Eastern Sunday 220319 - Up',
    'FP50 North Eastern Sunday 220319 - Down',

    'FP50 Northern Weekday 220319 - Up',
    'FP50 Northern Weekday 220319 - Down',
    'FP50 Northern Saturday 220319 - Up',
    'FP50 Northern Saturday 220319 - Down',
    'FP50 Northern Sunday 220319 - Up',
    'FP50 Northern Sunday 220319 - Down',

    'FP50 South Western Weekday 290319 - Up',
    'FP50 South Western Weekday 290319 - Down',
    'FP50 South Western Saturday 290319 - Up',
    'FP50 South Western Saturday 290319 - Down',
    'FP50 South Western Sunday 290319 - Up',
    'FP50 South Western Sunday 290319 - Down',

    'FP50 Western Weekday 220319 - Up',
    'FP50 Western Weekday 220319 - Down',
    'FP50 Western Saturday 220319 - Up',
    'FP50 Western Saturday 220319 - Down',
    'FP50 Western Sunday 220319 - Up',
    'FP50 Western Sunday 220319 - Down',
];

let timetables = {};

function operatingDaysToArray(days) {
    if (days == 'MF') return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri'];
    if (days == 'Sat') return ['Sat'];
    if (days == 'Sun' || days == 'SuO') return ['Sun'];
    if (days == 'Sat+Sun' || days == 'Sun+Sat') return ['Sat', 'Sun'];
    if (days == 'ME') return ['Tues', 'Wed', 'Thur', 'Fri'];
    if (days == 'MO') return ['Mon'];
    if (days == 'FO') return ['Fri'];
    if (days == 'Daily') return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'];
    throw Error('Unknown date');
}

function timingToMinutesAfterMidnight(timing) {
    if (!timing) return null;
    let parts = timing.slice(0, 5).split(':');
    return parts[0] * 60 + parts[1] * 1;
}

let timetableCount = 0;

async function loadTimetableCSV(filename) {
    let timetable = fs.readFileSync('vline_timetables/' + filename + '.csv').toString();
    timetable = await new Promise(r => parseCSV(timetable, {
        trim: true,
        skip_empty_lines: true
    }, (err, t) => r(t)));

    let leftColumns = timetable.map(row => row.slice(0, 2));
    let tripCount = timetable[0].length - 2;
    let trips = [];

    for (let i = 0; i < tripCount; i++) {
        let tripData = [];
        for (let j = 0; j < leftColumns.length; j++) {
            tripData.push(timetable[j][i + 2]);
        }
        trips.push(tripData);
    }

    let prevStation = '';
    leftColumns = leftColumns.slice(5, -1).map(e => {
        if (e[0]) prevStation = e[0];
        else e[0] = prevStation;
        return e;
    });
    let routeStops = leftColumns.map(e => e[0]).filter((e, i, a) => a.indexOf(e) == i);

    return { trips, routeStops, leftColumns };
}

async function loadTrips(csvData) {
    let { trips, routeStops, leftColumns } = csvData;

    await async.map(trips, async trip => {
        timetableCount++;
        let tripMeta = trip.slice(0, 5).concat(trip.slice(-1));
        let tripTimings = trip.slice(5, -1);

        let runID = tripMeta[0];
        let operationDays = operatingDaysToArray(tripMeta[1]);
        let vehicle = tripMeta[2];
        let formedBy = tripMeta[3];
        let forming = tripMeta[5];

        let tripStops = {};

        let i = 0;
        await async.map(tripTimings, async timing => {
            if (timing == '…/…') timing = '';

            let stationMeta = leftColumns[i++];
            let stationName = stationMeta[0],
                fieldContents = stationMeta[1];

            let station = await vlineRailwayStations.findDocument({ stationName: new RegExp(stationName + ' railway station', 'i') });

            let arrivalTime = null, departureTime = null;
            if (timing.includes('/')) {
                timing = timing.split('/');
                arrivalTime = timing[0];
                departureTime = timing[1];
            }
            if (!station) console.log(stationName)
            if (!tripStops[stationName]) tripStops[stationName] = {
                stationName: station.stationName,
                gtfsStationID: station.gtfsStationID,
                arrivalTime: arrivalTime || timing,
                departureTime: departureTime || timing,
                platform: null
            };

            if (timing.includes('*')) tripStops[stationName].express = true;
            if (fieldContents == 'Arr') tripStops[stationName].arrivalTime = timing;
            if (fieldContents == 'Dep') tripStops[stationName].departureTime = timing;
            if (fieldContents == 'Plat') tripStops[stationName].platform = timing;
        });

        let stops = routeStops.map(name => tripStops[name]).filter(Boolean).filter(e => !e.express).filter(e => e.arrivalTime + e.departureTime !== '');

        let destination = stops.slice(-1)[0].stationName;
        let departureTime = stops[0].departureTime;
        let origin = stops[0].stationName;

        let l = stops.length - 1;
        stops = stops.map((stop, i) => {
            if (i == 0) stop.arrivalTime = null;
            if (i == l) stop.departureTime = null;
            stop.arrivalTimeMinutes = timingToMinutesAfterMidnight(stop.arrivalTime);
            stop.departureTimeMinutes = timingToMinutesAfterMidnight(stop.departureTime);

            return stop;
        });

        let key = {
            runID, operatingDaysToArray, destination, departureTime, origin
        };
        let timetableData = {
            runID, operationDays, vehicle, formedBy, forming, stops, destination, departureTime, origin
        };

        if (await vnetTimetables.countDocuments(key)) {
            await vnetTimetables.updateDocument(key, {
                $set: timetableData
            });
        } else {
            await vnetTimetables.createDocument(timetableData);
        }
    });
}

database.connect({
    poolSize: 100
}, async err => {
    vlineRailwayStations = database.getCollection('vline railway stations');
    vnetTimetables = database.getCollection('vnet timetables');

    await async.map(files, async filename => {
        let csvData = await loadTimetableCSV(filename);
        await loadTrips(csvData);
    });
    console.log('Completed loading in ' + timetableCount + ' VNET timetables');
    process.exit();
});
