const request = require('request-promise');
const TimedCache = require('timed-cache');
const async = require('async');
const urls = require('../../../urls.json');

let departuresCache = new TimedCache({ defaultTtl: 1000 * 60 * 2 });

const cheerio = require('cheerio');

async function getDepartures(db) {
    let $ = cheerio.load(await request(urls.southernCrossDepartures));
    let services = [];
    let servicesIndex = [];

    function insertService(service) {
        let serviceIndex = service.destination + service.scheduledDepartureTime;
        if (servicesIndex.includes(serviceIndex)) return;
        servicesIndex.push(serviceIndex);
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

    console.log(services);
}

getDepartures();
