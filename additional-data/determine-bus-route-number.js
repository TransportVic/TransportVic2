/*
More flexible form of the GTFS Hardcoding method for trip variants
*/
module.exports = function (trip) {
  let { routeNumber, routeGTFSID } = trip

  // Metro bus - these have their route GTFS ids jump around all the time so match by route number
  if (routeGTFSID.startsWith('4-')) {
    /*
    H - A (Ridge Rd Only)
    K - B (Ridge Rd & Mount Dandenong Observatory)
    M - C (Elizabeth Bridge Reserve/Durham Road)
    */
    if (routeNumber === '688') {
      let hasRidge = trip.stopTimings.some(stop => stop.stopName === 'Mount Dandenong Arboretum/Ridge Road')
      if (trip.stopTimings.some(stop => stop.stopName === 'Elizabeth Bridge Reserve/Durham Road')) return '688C'
      if (hasRidge) {
        let hasObservatory = trip.stopTimings.some(stop => stop.stopName === 'Mount Dandenong Observatory/Observatory Road')
        if (hasObservatory) return '688B'
        else return '688A'
      }
    }

    if (routeNumber === '695' || routeNumber === '695F') { // It jumps around timetables
      let hasDandenong = trip.stopTimings.some(stop => stop.stopName === 'Dandenong Market/Cleeland Street')
      if (hasDandenong) return '695D'
    }

    if (routeNumber === '697' || routeNumber === '697F') { // It jumps around timetables
      let hasDandenong = trip.stopTimings.some(stop => stop.stopName === 'Dandenong Market/Cleeland Street')
      let hasFountainGate = trip.stopTimings.some(stop => stop.stopName === 'Fountain Gate Shopping Centre/Overland Drive')
      if (hasDandenong) return '697D'
      if (hasFountainGate) return '697F'
    }

    if (routeNumber === '745') {
      if (trip.destination === 'Bayswater Railway Station/Station Street') return '745A'
      if (trip.destination === 'Boronia Railway Station/Erica Avenue') return '745B'

      let hasBoroniaSC = trip.stopTimings.some(stop => stop.stopName === 'Bayswater Shopping Centre/High Street')
      if (hasBoroniaSC) return '745D'
      else return '745C'
    }

    if (routeNumber === '770') {
      if (trip.origin.includes('Orwil Street') || trip.destination.includes('Orwil Street')) return '770A'
    }
  } else if (routeGTFSID.startsWith('6-')) {
    if (routeGTFSID === '6-921') { // Mildura 100/200
      return ['200', '100'][trip.gtfsDirection]
    }
    if (routeGTFSID === '6-20b') { // Mildura 211/311/312
      if (trip.gtfsDirection === '0') { // Milura - Merbein
        if (trip.stopTimings.some(stop => stop.stopName === 'Mildura Central Shopping Centre/Fifteenth Street')) {
          return '311' // 311 via Mildura Central SC
        } else {
          return '312' // 312 direct to Mildura Station
        }
      } else { // Merbein - Mildura
        return '211'
      }
    }

    if (routeGTFSID === '6-920') { // Mildura 250/300
      return ['300', '250'][trip.gtfsDirection]
    }

    if (routeGTFSID === '6-946') { // Swan Hill Schools AM
      return 'AM'
    }
    if (routeGTFSID === '6-949') { // Swan Hill Schools PM
      return 'PM'
    }

    if (routeGTFSID === '6-gld') {
      return 'GOLD'
    }
  }

  return routeNumber
}
