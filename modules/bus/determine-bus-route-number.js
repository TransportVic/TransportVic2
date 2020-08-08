/*
More flexible form of the GTFS Hardcoding method for trip variants
*/
module.exports = function (trip) {
  let routeNumber = trip.routeNumber

  /*
  H - A (Ridge Rd Only)
  K - B (Ridge Rd & Mount Dandenong Observatory)
  M - C (Elizabeth Bridge Reserve/Durham Road)
  */
  if (routeNumber === '688') {
    let hasRidge = trip.stopTimings.find(stop => stop.stopName === 'Observatory Rd/Ridge Road')
    if (trip.stopTimings.find(stop => stop.stopName === 'Elizabeth Bridge Reserve/Durham Road')) return '688C'
    if (hasRidge) {
      let hasObservatory = trip.stopTimings.find(stop => stop.stopName === 'Mount Dandenong Observatory/Observatory Road')
      if (hasObservatory) return '688B'
      else return '688A'
    }
  }


  if (routeNumber === '695' || routeNumber === '695F') { // It jumps around timetables
    let hasDandenong = trip.stopTimings.find(stop => stop.stopName === 'Dandenong Market/Cleeland Street')
    if (hasDandenong) return '695D'
  }

  if (routeNumber === '697' || routeNumber === '695F') { // It jumps around timetables
    let hasDandenong = trip.stopTimings.find(stop => stop.stopName === 'Dandenong Market/Cleeland Street')
    let hasFountainGate = trip.stopTimings.find(stop => stop.stopName === 'Fountain Gate Shopping Centre/Overland Drive')
    if (hasDandenong) return '697D'
    if (hasFountainGate) return '697F'
  }

  if (routeNumber === '745') {
    if (trip.destination === 'Bayswater Railway Station/Station Street') return '745A'
    if (trip.destination === 'Boronia Railway Station/Erica Avenue') return '745B'

    let hasBoroniaSC = trip.stopTimings.find(stop => stop.stopName === 'Bayswater Shopping Centre/High Street')
    if (hasBoroniaSC) return '745D'
    else return '745C'
  }

  if (routeNumber === '770') {
    if (trip.origin.includes('Orwil Street') || trip.destination.includes('Orwil Street')) return '770A'
  }

  return routeNumber
}
