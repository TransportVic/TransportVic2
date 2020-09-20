const urls = require('../../urls.json')
const utils = require('../../utils')
const cheerio = require('cheerio')
const async = require('async')

async function getStationFromVNETName(vnetStationName, db) {
  const station = await db.getCollection('stops').findDocument({
    bays: {
      $elemMatch: {
        mode: 'regional train',
        vnetStationName
      }
    }
  })

  return station
}

async function getVNETDepartures(stationName, direction, db, time) {
  let url = urls.vlinePlatformDepartures.format(stationName, direction, time)
  const body = (await utils.request(url)).replace(/a:/g, '')
  const $ = cheerio.load(body)
  const allServices = Array.from($('PlatformService'))

  let mappedDepartures = []

  await async.forEach(allServices, async service => {
    function $$(q) {
      return $(q, service)
    }

    let platform = $$('Platform').text()
    let originDepartureTime = utils.parseTime($$('ScheduledDepartureTime').text())
    let destinationArrivalTime = utils.parseTime($$('ScheduledDestinationArrivalTime').text())
    let runID = $$('ServiceIdentifier').text()
    let originVNETName = $$('Origin').text()
    let destinationVNETName = $$('Destination').text()

    let accessibleTrain = $$('IsAccessibleAvailable').text() === 'true'
    let barAvailable = $$('IsBuffetAvailable').text() === 'true'

    let vehicle = $$('Consist').text().replace(/ /g, '-')
    let vehicleConsist = $$('ConsistVehicles').text().replace(/ /g, '-')

    let fullVehicle = vehicle
    let vehicleType
    let set

    if (vehicle.match(/N\d{3}/)) {
      let carriages = vehicleConsist.slice(5).split('-')
      let excludes = ['ACN13', 'FLH32', 'B219', 'BRN']
      excludes.forEach(exclude => {
        if (carriages.includes(exclude)) {
          carriages.splice(carriages.indexOf(exclude), 1)
        }
      })
      if (carriages.includes('BCZ260')) carriages[carriages.indexOf('BCZ260')] = 'PCJ491'
      vehicleConsist = vehicleConsist.slice(0, 5) + carriages.join('-')

      fullVehicle = vehicleConsist

      vehicleType = 'N +'
      vehicleType += carriages.length

      if (carriages.includes('N')) vehicleType += 'N'
      else vehicleType += 'H'

      set = vehicle.split('-').find(x => !x.startsWith('N') && !x.startsWith('P'))
    } else if (vehicle.includes('VL')) {
      let cars = vehicle.split('-')
      fullVehicle = vehicle.replace(/\dVL/g, 'VL')

      vehicleType = cars.length + 'x 3VL'
    } else if (vehicle.match(/70\d\d/)) {
      let cars = vehicle.split('-')
      vehicleType = cars.length + 'x SP'
    } else {
      if (vehicle.includes('N') || vehicle.includes('H')) {
        fullVehicle = ''
        vehicleType = ''
      }
    }

    if ($$('Consist').attr('i:nil'))
      fullVehicle = ''

    let direction = $$('Direction').text()
    if (direction === 'D') direction = 'Down'
    else direction = 'Up'

    const originStation = await getStationFromVNETName(originVNETName, db)
    const destinationStation = await getStationFromVNETName(destinationVNETName, db)

    if (!originStation || !destinationStation) return // Apparently origin or dest is sometimes unknown

    let originVLinePlatform = originStation.bays.find(bay => bay.mode === 'regional train')
    let destinationVLinePlatform = destinationStation.bays.find(bay => bay.mode === 'regional train')

    mappedDepartures.push({
      runID,
      originVNETName: originVLinePlatform.vnetStationName,
      destinationVNETName: destinationVLinePlatform.vnetStationName,
      origin: originVLinePlatform.fullStopName,
      destination: destinationVLinePlatform.fullStopName,
      platform,
      originDepartureTime, destinationArrivalTime,
      direction,
      vehicle: fullVehicle.split('-').filter((e, i, a) => a.indexOf(e) === i), // Simple deduper
      barAvailable,
      accessibleTrain,
      vehicleType,
      set
    })
  })

  return mappedDepartures
}

module.exports = getVNETDepartures
