function transformBusStop(inputStop) {
  let ticketZones = inputStop.properties.TICKETZONE || ''

  return {
    stopGTFSID: inputStop.properties.STOP_ID,
    mykiZones: ticketZones.split(',').map(e => parseInt(e)).filter(Boolean),
    stopName: inputStop.properties.STOP_NAME,
    services: (inputStop.properties.ROUTEUSSP || '').split(',')
  }
}

function createStopsLookup(stopsJSON) {
  let lookupTable = {}
  stopsJSON.forEach(stop => {
    let transformed = transformBusStop(stop)

    lookupTable[transformed.stopGTFSID] = transformed
  })

  return lookupTable
}

module.exports = {
  createStopsLookup
}
