let depots = [
  'Miller Street/St. Georges Road',
  'Southbank Tram Depot/Light Rail',
  'Brunswick Tram Depot/Sydney Road',
  'Glenhuntly Tram Depot/Glenhuntly Road',
  'Camberwell Tram Depot/Riversdale Road',
  'Essendon Tram Depot/Mount Alexander Road',
  'Malvern Tram Depot/Glenferrie Road',
  'Glenferrie Road/Malvern Road',
  'High Street/Barkers Road',
  'Glenferrie Road/High Street' // 6d Malvern Town Hall
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
