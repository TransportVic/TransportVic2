let depots = [
  'Miller Street/St. Georges Road',
  'Southbank Tram Depot/Light Rail',
  'Brunswick Tram Depot/Sydney Road',
  'Glenhuntly Tram Depot/Glenhuntly Road',
  'Camberwell Tram Depot/Riversdale Road',
  'Essendon Tram Depot/Mount Alexander Road',
  'Malvern Tram Depot/Glenferrie Road',
  'High Street/Barkers Road'
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
    if (trip.destination === stVincent || trip.origin === stVincent) return '11b'
  }

  return routeNumber
}
