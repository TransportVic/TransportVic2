const request = require('request-promise')
const ptvAPI = require('../ptv-api')

let isOnline = true

var refreshRate = 10;

async function refreshCache() {
  try {
    const {status} = await ptvAPI('/v3/disruptions')
    isOnline = true
  } catch (e) {
    console.log('Failed to pass health check, running offline')
    isOnline = false
  }
}

setInterval(refreshCache, refreshRate * 60 * 1000);
refreshCache();

module.exports.isOnline = () => isOnline;
