const express = require('express');
const router = new express.Router();
const getDepartures = require('../../modules/vline/realtime_arrivals/get_departures');

router.get('/', (req, res) => {
    res.render('index');
});

router.post('/', async (req, res) => {
    let {stn} = req.body;

    res.setHeader('Content-Type', 'text/html');

    let station = await res.db.getCollection('vline railway stations').findDocument({
        stationName: new RegExp(stn, 'i')
    });
    if (!station) {
        res.end('Could not lookup timings for ' + stn + '. Are you sure V/Line trains stop there?');
        return;
    }
    let departures = await getDepartures(station, res.db);

    let text = ''

    text += 'Services departing ' + station.stationName + ' are:<br />';
    Object.values(departures).map(trip => {
        trip.stopData = trip.trip.stops.filter(stop => stop.gtfsStationID == station.gtfsStationID)[0];
        return trip;
    }).sort((a, b) => a.stopData.departureTimeMinutes - b.stopData.departureTimeMinutes).forEach(trip => {
        let {stopData} = trip;
        let {destination} = trip.trip;
         text += `The ${stopData.departureTime.slice(0, 5)} ${destination.slice(0, -16)}`

        if (trip.estDeparturetime) {
            let minutes = Math.floor((trip.estDeparturetime - new Date()) / 1000 / 60);
            text += `, departing Platform ${trip.platform}`;
            if (minutes > 0) text += ` in ${minutes} minutes.`;
            else text += ` now.`;
        }
        text += '<br />';
    });

    res.end(text);
})

module.exports = router;
