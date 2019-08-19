const request = require('request-promise')
const async = require('async')
const urls = require('../../../urls.json')

const cheerio = require('cheerio')

const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

function parseTime (time, from) {
  if (time === 'Now') return from
  const parts = time.match(/(\d+)/g)

  let hours = 0; let minutes = 0
  if (parts[1]) { // x h, y min
    hours = parts[0] * 1
    minutes = parts[1] * 1
  } else { // x min
    minutes = parts[0] * 1
  }

  const resultantTime = +from + (hours * 60 + minutes) * 1000 * 60
  return new Date(resultantTime)
}

async function getDepartures (db) {
  const vnetTimetables = db.getCollection('vnet timetables')
  const $ = cheerio.load(await request(urls.southernCrossDepartures))
  const services = []
  const servicesIndex = []

  function insertService (service) {
    const serviceIndex = service.destination + service.scheduledDepartureTime
    if (servicesIndex.includes(serviceIndex)) return
    servicesIndex.push(serviceIndex)

    service.actualDepartureTime = parseTime(service.actualDepartureTime, new Date())

    services.push(service)
  }

  const destinationRows = Array.from($('.table.departureboard-module tbody .rowModule'))
  destinationRows.forEach(row => {
    const firstServiceSchedule = $('.first-service .tdeparture-destination', row)
    const firstServiceScheduledTime = $('.mdepartuertime', firstServiceSchedule).text().trim()
    const firstServiceDestination = $('.mtowardsdes', firstServiceSchedule).text().slice(8).trim()
    const firstServicePlatform = $('.first-service .mPlatform', row).text().trim()
    const firstServiceActualTime = $('.first-service .mDepMin', row).text().trim()

    if (!firstServicePlatform.toLowerCase().includes('coach')) {
      insertService({
        destination: firstServiceDestination,
        scheduledDepartureTime: firstServiceScheduledTime,
        platform: firstServicePlatform.slice(-6).trim(),
        actualDepartureTime: firstServiceActualTime
      })
    }

    const otherDepartures = Array.from($('.table.sub-module.shownormal'))
    otherDepartures.forEach(departure => {
      const scheduledDepartureTime = $('.scoDeptime', departure).text().trim()
      const destination = $('.scoDepDestination', departure).text().trim()
      const platform = $('.scoPlatform .platform', departure).text().trim()
      const actualDepartureTime = $('.scoPlatform .departing-in', departure).text().trim()
      insertService({
        destination, scheduledDepartureTime, platform, actualDepartureTime
      })
    })
  })

  const now = new Date()
  const today = daysOfWeek[now.getDay()]

  return (await async.map(services, async service => {
    const trip = await vnetTimetables.findDocument({
      origin: 'Southern Cross Railway Station',
      destination: service.destination + ' Railway Station',
      departureTime: service.scheduledDepartureTime,
      operationDays: today
    })

    // TODO: find a way to load in special services - maybe no stopping pattern?
    if (!trip) return null

    return {
      trip,
      estDeparturetime: service.actualDepartureTime,
      platform: service.platform,
      stopData: trip.stops[0]
    }
  })).filter(Boolean).sort((a, b) => a.stopData.departureTimeMinutes - b.stopData.departureTimeMinutes)
}

module.exports = getDepartures
