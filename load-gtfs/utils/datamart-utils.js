const utils = require('../../utils')

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

function fixOperator(operator) {
  operator = operator.trim()

  if (operator === 'CDC') return 'CDC Melbourne'
  if (operator.includes('Ventura')) return 'Ventura Bus Lines'
  if (operator === 'Transdev') return 'Transdev Melbourne'
  if (operator === 'McHarrys') return 'McHarrys Bus Lines'
  if (operator === 'Panorama') return 'Panorama Coaches'

  if (operator.includes('Dysons ')) {
    return `Dysons (${operator.slice(7)})`
  }

  operator = operator.replace('Night Bus - ', '')

  if (operator === 'McKenzies') return 'McKenzies Tourist Service'
  return operator
}

function createServiceLookup(serviceJSON) {
  let lookupTable = {}
  serviceJSON.forEach(service => {
    let routeIDFull = service.properties.ROUTE_ID
    let shapeID = service.properties.SHAPE_ID
    let routeGTFSID = utils.simplifyRouteGTFSID(routeIDFull)

    if (!lookupTable[routeGTFSID])
      lookupTable[routeGTFSID] = {
        operator: service.properties.OPERATOR.split(',').map(fixOperator),
        routeNumber: service.properties.ROUTESHTNM,
        routeName: utils.adjustRouteName(service.properties.ROUTELONGN)
      }
  })

  return lookupTable
}

module.exports = {
  createStopsLookup,
  createServiceLookup,
  fixOperator
}
