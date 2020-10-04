let depots = [
  'Miller Street/St. Georges Road',
  'Southbank Tram Depot/Light Rail',
  'Brunswick Tram Depot/Sydney Road',
  'Glenhuntly Tram Depot/Glenhuntly Road',
  'Camberwell Tram Depot/Riversdale Road',
  'Essendon Tram Depot/Mount Alexander Road',
  'Malvern Tram Depot/Glenferrie Road',
  'Moreland Road/Nicholson Street', // 1d Holmes & Moreland Roads (Note: Is junction)
  'Hawthorn Road/Balaclava Road', // 3d Balaclava Junction
  'Glenferrie Road/High Street', // 6d Malvern Town Hall
  'Mercer Road/High Street', // 6d Malvern Town Hall
  'Moreland Road/Sydney Road', // 19d Moreland & Sydney Roads
  'Royal Park', // 58d Abbotsford Street Interchange
  'Glenhuntly Road/Hawthorn Road', // 64d Glenhuntly & Hawthorn Roads
  'Glenferrie Road/Malvern Road', // 72d Malvern Tram Depot
  'Casino/MCEC', //96d Southbank Depot & Casino
  'High Street/Barkers Road' // 109d Kew Tram Depot
]

module.exports = function (trip) {
  let routeNumber = trip.routeNumber
  if (trip.routeNumber === '3/3a') {
    let hasStKilda = trip.stopTimings.find(stop => stop.stopName === 'Luna Park/The Esplanade')
    if (hasStKilda) return '3a'
    routeNumber = '3'
  }

  if (depots.includes(trip.destination)) {
    return routeNumber + 'd'
  }

  // 11ab special
  if (routeNumber === '11') {
    let stVincent = 'St. Vincents Plaza/Victoria Parade'
    if (trip.destination === stVincent || trip.origin === stVincent) return '11a' // PTV says its 11b but TT gives 11a so...
  }

  if (routeNumber === '12') {
    let hasLaTrobe = trip.stopTimings.find(stop => stop.stopName === 'William Street/La Trobe Street')
    if (hasLaTrobe) return '12a'
    routeNumber = '12'
  }

  if (routeNumber === '16') {
    if (trip.destination === 'Federation Square/Swanston Street') return '16a'
  }

  return routeNumber
}
