const request = require('request-promise');
const TimedCache = require('timed-cache');
const async = require('async');
const urls = require('../../../urls.json');

let departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 });

const cheerio = require('cheerio');

let daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat'];

async function getDepartures(station, db) {
    if (departuresCache.get(station.stationName)) {
        return departuresCache.get(station.stationName);
    }

    let vnetTimetables = db.getCollection('vnet timetables');

    let now = new Date();
    let minutesPastMidnight = now.getHours() * 60 + now.getMinutes();
    let today = daysOfWeek[now.getDay()];

    let trips = await vnetTimetables.findDocuments({
        stops: {
            $elemMatch: {
                gtfsStationID: station.gtfsStationID,
                departureTimeMinutes: {
                    $gt: minutesPastMidnight,
                    $lte: minutesPastMidnight + 60
                }
            }
        },
        operationDays: today
    });
    let allTrips = {};
    trips.forEach(trip => allTrips[trip.runID] = {trip});

    let body = await request(urls.vlinePlatformDepartures.format(station.vnetStationName));
    body = body.replace(/a:/g, '');
    let $ = cheerio.load(body);
    let allServices = Array.from($('PlatformService'));

    await async.map(allServices, async service => {
        let runID = $('ServiceIdentifier', service).text();
        let estDeparturetime = new Date($('ActualArrivalTime', service).text());
        let platform = $('Platform', service).text();
        if (isNaN(estDeparturetime)) return;

        estDeparturetime = new Date(estDeparturetime);
        let timetable = await vnetTimetables.findDocument({ runID, operationDays: today });
        allTrips[runID] = {trip: timetable, estDeparturetime, platform};
    });

    let departures = Object.values(allTrips).map(trip => {
        trip.stopData = trip.trip.stops.filter(stop => stop.gtfsStationID == station.gtfsStationID)[0];
        return trip;
    }).sort((a, b) => a.stopData.departureTimeMinutes - b.stopData.departureTimeMinutes);

    departuresCache.put(station.stationName, departures);
    return departures;
}

module.exports = getDepartures;
