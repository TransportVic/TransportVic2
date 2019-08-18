const request = require('request-promise');
const async = require('async');
const urls = require('../../../urls.json');

const cheerio = require('cheerio');

let daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat'];

function parseTime(time, from) {
    if (time == 'Now') return from;
    let parts = time.match(/(\d+)/g);

    let hours = 0, minutes = 0;
    if (parts[1]) { // x h, y min
        hours = parts[0] * 1;
        minutes = parts[1] * 1;
    } else { // x min
        minutes = parts[0] * 1;
    }

    let resultantTime = +from + (hours * 60 + minutes) * 1000 * 60;
    return new Date(resultantTime);
}

async function getDepartures(db) {
    let vnetTimetables = db.getCollection('vnet timetables');
    let $ = cheerio.load(await request(urls.southernCrossDepartures));
    let services = [];
    let servicesIndex = [];

    function insertService(service) {
        let serviceIndex = service.destination + service.scheduledDepartureTime;
        if (servicesIndex.includes(serviceIndex)) return;
        servicesIndex.push(serviceIndex);

        service.actualDepartureTime = parseTime(service.actualDepartureTime, new Date());

        services.push(service);
    }

    let destinationRows = Array.from($('.table.departureboard-module tbody .rowModule'));
    destinationRows.forEach(row => {
        let firstServiceSchedule = $('.first-service .tdeparture-destination', row);
        let firstServiceScheduledTime = $('.mdepartuertime', firstServiceSchedule).text().trim();
        let firstServiceDestination = $('.mtowardsdes', firstServiceSchedule).text().slice(8).trim();
        let firstServicePlatform = $('.first-service .mPlatform', row).text().trim();
        let firstServiceActualTime = $('.first-service .mDepMin', row).text().trim();

        if (!firstServicePlatform.toLowerCase().includes('coach')) {
            insertService({
                destination: firstServiceDestination,
                scheduledDepartureTime: firstServiceScheduledTime,
                platform: firstServicePlatform.slice(-6).trim(),
                actualDepartureTime: firstServiceActualTime
            });
        }

        let otherDepartures = Array.from($('.table.sub-module.shownormal'));
        otherDepartures.forEach(departure => {
            let scheduledDepartureTime = $('.scoDeptime', departure).text().trim();
            let destination = $('.scoDepDestination', departure).text().trim();
            let platform = $('.scoPlatform .platform', departure).text().trim();
            let actualDepartureTime = $('.scoPlatform .departing-in', departure).text().trim();
            insertService({
                destination, scheduledDepartureTime, platform, actualDepartureTime
            });
        });
    });

    let now = new Date();
    let today = daysOfWeek[now.getDay()];

    return (await async.map(services, async service => {
        let trip = await vnetTimetables.findDocument({
            origin: 'Southern Cross Railway Station',
            destination: service.destination + ' Railway Station',
            departureTime: service.scheduledDepartureTime,
            operationDays: today
        });

        return {
            trip,
            estDeparturetime: service.actualDepartureTime,
            platform: service.platform,
            stopData: trip.stops[0]
        }
    })).sort((a, b) => a.stopData.departureTimeMinutes - b.stopData.departureTimeMinutes);

}

module.exports = getDepartures;
