const crypto = require('crypto');
const request = require('request-promise');
const {ptvKey, ptvDevID} = require('./config.json');

function getURL(request) {
    request += (request.includes('?') ? '&' : '?') + 'devid=' + ptvDevID;
    let signature = crypto.createHmac('SHA1', ptvKey).update(request).digest('hex').toString('hex');
    return 'https://timetableapi.ptv.vic.gov.au' + request + '&signature=' + signature;
}

async function makeRequest(url) {
    let fullURL = getURL(url);

    let start = +new Date();
    let body = await request(fullURL)
    let end = +new Date();
    let diff = end - start;
    console.log(`${diff}ms ${fullURL}`);
    
    return JSON.parse(body);
}

module.exports = makeRequest
