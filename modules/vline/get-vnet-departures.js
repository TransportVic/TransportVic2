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

    let rawVehicle = $$('Consist').text()
    let shortConsist = rawVehicle.split(' ').filter((e, i, a) => a.indexOf(e) === i)
    let allCars = $$('ConsistVehicles').text().split(' ').filter((e, i, a) => a.indexOf(e) === i)

    if ($$('Consist').attr('i:nil')) {
      rawVehicle = ''
      shortConsist = []
      allCars = []
    }

    let consist = []
    let vehicleType = ''
    let set = null

    let consistType
    if (rawVehicle.includes('VL')) consistType = 'Vlocity'
    else if (rawVehicle.match(/70\d{2}/)) consistType = 'Sprinter'
    else consistType = 'Loco'

    if (consistType === 'Vlocity') {
      consist = shortConsist.map(vlo => vlo.replace(/\dVL/g, 'VL'))
      vehicleType = shortConsist.length + 'x 3VL'
    } else if (consistType === 'Sprinter') {
      consist = shortConsist
      vehicleType = shortConsist.length + 'x SP'
    } else if (consistType === 'Loco') {
      let locos = shortConsist.filter(car => car.match(/^[ANP]\d{2,3}$/))
      let powerVan = shortConsist.find(car => car.match(/^P[CHZ]J?\d{3}$/))
      set = shortConsist.filter(car => !locos.includes(car) && car !== powerVan).join(' ')
      let setVehicles = allCars.filter(car => !locos.includes(car) && car !== powerVan)

      if (locos.length) consist = locos
      consist = consist.concat(setVehicles)
      if (powerVan) consist.push(powerVan)
    }

    let direction = $$('Direction').text()
    if (direction === 'D') direction = 'Down'
    else direction = 'Up'

    let originStation = await getStationFromVNETName(originVNETName, db)
    let destinationStation = await getStationFromVNETName(destinationVNETName, db)

    if (!originStation || !destinationStation) return // Apparently origin or dest is sometimes unknown

    let originVLinePlatform = originStation.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)
    let destinationVLinePlatform = destinationStation.bays.find(bay => bay.mode === 'regional train' && bay.stopGTFSID < 140000000)

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
