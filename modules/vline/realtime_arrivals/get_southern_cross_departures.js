const request = require('request-promise')
const async = require('async')
const urls = require('../../../urls.json')
const cheerio = require('cheerio')
const moment = require('moment')
require('moment-timezone')

const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

function parseTimeFrom (time, from) {
  if (time === 'Now') return from
  const parts = time.match(/(\d+)/g)

  let hours = 0; let minutes = 0
  if (parts[1]) { // x h, y min
    hours = parts[0] * 1
    minutes = parts[1] * 1
  } else { // x min
    minutes = parts[0] * 1
  }

  return from.clone().add(hours, 'hours').add(minutes, 'minutes')
}

function parse24Time (time, from) {
  const parts = time.split(':')

  return from.clone().add(parts[0], 'hours').add(parts[1], 'minutes')
}

async function getDepartures (db) {
  const vnetTimetables = db.getCollection('vnet timetables')
  const $ = cheerio.load(await request(urls.southernCrossDepartures))
  const services = []
  const servicesIndex = []

  const now = moment().tz('Australia/Melbourne')
  const startOfToday = now.clone().startOf('day')
  const today = daysOfWeek[now.day()]

  function insertService (service) {
    if (service.destination === 'er services today') return

    const serviceIndex = service.destination + service.scheduledDepartureTime
    if (servicesIndex.includes(serviceIndex)) return
    servicesIndex.push(serviceIndex)

    service.estimatedDepartureTime = parseTimeFrom(service.estimatedDepartureTime, now)

    services.push(service)
  }

  const destinationRows = Array.from($('.table.departureboard-module tbody .rowModule'))
  destinationRows.forEach(row => {
    const firstServiceSchedule = $('.first-service .tdeparture-destination', row)
    const firstServiceScheduledTime = $('.mdepartuertime', firstServiceSchedule).text().trim()
    const firstServiceDestination = $('.mtowardsdes', firstServiceSchedule).text().slice(8).trim()
    const firstServicePlatform = $('.first-service .mPlatform', row).text().trim()
    const firstServiceActualTime = $('.first-service .mDepMin', row).text().trim()

    const isCoachService = firstServicePlatform.includes('Coach')
    insertService({
      destination: firstServiceDestination,
      scheduledDepartureTime: firstServiceScheduledTime,
      platform: firstServicePlatform.slice(-6).trim(),
      estimatedDepartureTime: firstServiceActualTime,
      isCoachService
    })

    const otherDepartures = Array.from($('.table.sub-module.shownormal'))
    otherDepartures.forEach(departure => {
      const scheduledDepartureTime = $('.scoDeptime', departure).text().trim()
      const destination = $('.scoDepDestination', departure).text().trim()
      const platform = $('.scoPlatform .platform', departure).text().trim()
      const estimatedDepartureTime = $('.scoPlatform .departing-in', departure).text().trim()
      const isCoachService = platform >= 17
      insertService({
        destination, scheduledDepartureTime, platform, estimatedDepartureTime, isCoachService
      })
    })
  })

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
      estimatedDepartureTime: service.estimatedDepartureTime,
      scheduledDepartureTime: parse24Time(service.scheduledDepartureTime, startOfToday),
      platform: service.platform,
      stopData: trip.stops[0],
      isCoachService: service.isCoachService
    }
  })).filter(Boolean).sort((a, b) => {
    return (a.estimatedDepartureTime || a.scheduledDepartureTime) - (b.estimatedDepartureTime || b.scheduledDepartureTime)
  })
}

module.exports = getDepartures
