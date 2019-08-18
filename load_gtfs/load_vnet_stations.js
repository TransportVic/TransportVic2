const DatabaseConnection = require('../database/DatabaseConnection');
const config = require('../config.json');
let database = new DatabaseConnection(config.databaseURL, 'TransportVic2');
let vlineRailwayStations = null;

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const fs = require('fs');
const async = require('async');
let data = fs.readFileSync('load_gtfs/all_vline_stations.xml').toString();
data = data.replace(/a:/g, '');
const dom = new JSDOM(data);

let completedStations = [];

let stations = Array.from(dom.window.document.querySelectorAll('Location')).filter(location => {
    return location.querySelector('StopType').textContent == 'Station';
}).map(location => {
    let vnetStationName = location.querySelector('LocationName').textContent;
    let stationName = vnetStationName.replace(/^Melbourne[^\w]+/, '').replace(/\(.+\)/g, '')
        .replace(/: .+/, '').replace(/Station.*/, '').replace(/Railway.*/, '').replace(/  +/, ' ')
        .trim() + ' Railway Station';
    if (completedStations.includes(stationName)) return null;

    completedStations.push(stationName);
    return {
        stationName,
        vnetStationName
    };
}).filter(Boolean);

database.connect({
    poolSize: 100
}, async err => {
    vlineRailwayStations = database.getCollection('vline railway stations');
    await new Promise(r => async.map(stations, async station => {
        await vlineRailwayStations.updateDocument({ stationName: station.stationName }, {
            $set: {
                vnetStationName: station.vnetStationName
            }
        });
    }, r));

    console.log('Completed updating ' + stations.length + ' V/Line station VNET names');
    process.exit();
});
