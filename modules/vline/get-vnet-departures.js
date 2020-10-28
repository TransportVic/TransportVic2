const urls = require('../../urls.json')
const utils = require('../../utils')
const cheerio = require('cheerio')
const async = require('async')
const { getDayOfWeek } = require('../../public-holidays')

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

async function getVNETDepartures(stationName, direction, db, time, useArrivalInstead=false) {
  let baseURL = useArrivalInstead ? urls.vlinePlatformArrivals : urls.vlinePlatformDepartures
  let url = baseURL.format(stationName, direction, time)
  const body = (await utils.request(url)).replace(/a:/g, '')

  const $ = cheerio.load(body)
  const allServices = Array.from($('PlatformService'))

  let mappedDepartures = []

  await async.forEach(allServices, async service => {
    function $$(q) {
      return $(q, service)
    }

    let platform = $$('Platform').text()
    if (platform.length > 5) platform = null

    let originDepartureTime = utils.parseTime($$('ScheduledDepartureTime').text())
    let destinationArrivalTime = utils.parseTime($$('ScheduledDestinationArrivalTime').text())

    let estimatedStopArrivalTime, estimatedDestArrivalTime
    let providedActualArrivalTime = $$('ActualArrivalTime').text()
    let providedDestArrivalTime = $$('ActualDestinationArrivalTime').text()

    if (providedActualArrivalTime.length === 19) {
      estimatedStopArrivalTime = utils.parseTime(providedActualArrivalTime)
      estimatedDestArrivalTime = utils.parseTime(providedDestArrivalTime)
    }

    let runID = $$('ServiceIdentifier').text()
    let originVNETName = $$('Origin').text()
    let destinationVNETName = $$('Destination').text()

    if (!originDepartureTime.isValid()) return // Some really edge case where it returns a run with no departure data - discard it

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

    let originStation = await getStationFromVNETName(originVNETName, db)
    let destinationStation = await getStationFromVNETName(destinationVNETName, db)

    if (!originStation || !destinationStation) return // Apparently origin or dest is sometimes unknown

    let originVLinePlatform = originStation.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)
    let destinationVLinePlatform = destinationStation.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)

    let consist = fullVehicle.split('-').filter((e, i, a) => a.indexOf(e) === i) // Simple deduper
    let dayOfWeek = await getDayOfWeek(originDepartureTime)
    let isWeekday = utils.isWeekday(dayOfWeek)

    if (runID === '8147' && isWeekday) consist.reverse()

    mappedDepartures.push({
      runID,
      originVNETName: originVLinePlatform.vnetStationName,
      destinationVNETName: destinationVLinePlatform.vnetStationName,
      origin: originVLinePlatform.fullStopName,
      destination: destinationVLinePlatform.fullStopName,
      platform,
      originDepartureTime,
      destinationArrivalTime,
      estimatedStopArrivalTime,
      estimatedDestArrivalTime,
      direction,
      vehicle: consist,
      barAvailable,
      accessibleTrain,
      vehicleType,
      set
    })
  })

  return mappedDepartures
}

module.exports = getVNETDepartures
