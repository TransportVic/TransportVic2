import utils from '../../../utils.mjs'

let stopDates = {}

export default {
  groupDepartures: departures => {
    let services = []
    let groupedDepartures = {}
    departures.forEach(departure => {
      if (!services.includes(departure.sortNumber)) {
        services.push(departure.sortNumber)
        groupedDepartures[departure.sortNumber] = {}
      }
    })

    services.forEach(service => {
      let serviceDepartures = departures.filter(d => d.sortNumber === service)
      let serviceDestinations = []

      let directions = [
        serviceDepartures.filter(d => d.trip.gtfsDirection === 0),
        serviceDepartures.filter(d => d.trip.gtfsDirection === 1)
      ]

      if (serviceDepartures[0].trip.routeGTFSID === '3-35') {
        let nonLoop = serviceDepartures.filter(d => !d.loopDirection)
        let loop = serviceDepartures.filter(d => d.loopDirection)

        let d0 = loop.filter(d => d.trip.gtfsDirection === 0)
        let d1 = loop.filter(d => d.trip.gtfsDirection === 1)

        directions = [
          nonLoop, d0, d1
        ]
      }

      directions.forEach(direction => {
        let destinationDepartures = []
        let destinations = []

        direction.forEach(departure => {
          let destination = departure.destination + departure.viaText + departure.loopDirection + departure.routeNumber

          if (!destinations.includes(destination)) {
            destinations.push(destination)
            destinationDepartures.push({
              destination,
              departures: direction.filter(d => d.destination + d.viaText + d.loopDirection + d.routeNumber === destination)
            })
          }
        })

        let sortedDepartures = destinationDepartures.sort((a, b) => a.departures[0].actualDepartureTime - b.departures[0].actualDepartureTime)
        sortedDepartures.forEach(departureSet => {
          groupedDepartures[service][departureSet.destination] = departureSet.departures
        })
      })
    })
    
    let hasNoNumber = services.includes('')
    let alphaRoutes = services.filter(service => service.match(/^[A-Za-z]/))
    let numberRoutes = services.filter(service => service.match(/^\d/))

    let sortedServices = []
    if (hasNoNumber) sortedServices.push('')
    sortedServices = sortedServices.concat(alphaRoutes.sort((a, b) => {
      return a.localeCompare(b)
    })).concat(numberRoutes.sort((a, b) => {
      return a - b
    }))

    return { services: sortedServices, groupedDepartures }
  },
  getStopHeritageUseDates: async (db, stop) => {
    let bay = stop.bays.find(bay => bay.mode === 'heritage train')
    if (bay) {
      if (stopDates[bay.stopGTFSID]) return stopDates[bay.stopGTFSID]

      let gtfsTimetables = db.getCollection('gtfs timetables')
      let dates = await gtfsTimetables.distinct('operationDays', {
        mode: 'heritage train',
        'stopTimings.stopGTFSID': bay.stopGTFSID
      })

      let moments = dates.map(date => utils.parseDate(date))
      stopDates[bay.stopGTFSID] = moments

      return moments
    } else {
      return []
    }
  }
}
