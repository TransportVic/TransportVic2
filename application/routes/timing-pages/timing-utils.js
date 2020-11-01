module.exports = {
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
        serviceDepartures.filter(d => d.trip.gtfsDirection === '0'),
        serviceDepartures.filter(d => d.trip.gtfsDirection === '1')
      ]

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
  }
}
