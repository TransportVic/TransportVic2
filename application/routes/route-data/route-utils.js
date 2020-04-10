const moment = require('moment')
const async = require('async')

let frequencyRanges = {
  'Early Morning': [[3, 0], [6, 00]],
  'Morning Peak': [[6, 00], [10, 0]],
  'Afternoon': [[10, 0], [16, 30]],
  'Evening Peak': [[16, 30], [20, 30]],
  'Night': [[20, 30], [27, 0]]
}

function getDistantWeekdays(allAvailableDays) {
  let weekdays = allAvailableDays.filter(day => {
    let dayOfWeek = day.day()

    return 0 < dayOfWeek && dayOfWeek < 6
  })
  let sorted = weekdays.sort((a, b) => b - a)
  let lastSeven = sorted.slice(0, 7)
  let seenDaysOfWeek = []

  let uniqueDays = lastSeven.filter(day => {
    let dayOfWeek = day.day()

    if (seenDaysOfWeek.includes(dayOfWeek)) return false
    seenDaysOfWeek.push(dayOfWeek)

    return true
  })

  return uniqueDays.map(day => {
    return day.format('YYYYMMDD')
  })
}

function getDistantSaturday(allAvailableDays) {
  let saturdays = allAvailableDays.filter(day => {
    let dayOfWeek = day.day()

    return dayOfWeek === 6
  })

  let sorted = saturdays.sort((a, b) => b - a)
  let lastThree = sorted.slice(0, 3)

  // filter out public hols

  return lastThree.length ? lastThree[0].format('YYYYMMDD') : null
}

function getDistantSunday(allAvailableDays) {
  let sundays = allAvailableDays.filter(day => {
    let dayOfWeek = day.day()

    return dayOfWeek === 0
  })

  let sorted = sundays.sort((a, b) => b - a)
  let lastThree = sorted.slice(0, 3)

  return lastThree.length ? lastThree[0].format('YYYYMMDD') : null
}

function parseOperationDays(operationDays) {
  return operationDays.map(day => {
    return moment.tz(day, 'YYYYMMDD', 'Australia/Melbourne')
  })
}

async function findTripsForDates(gtfsTimetables, query, dates) {
  let trips = await gtfsTimetables.findDocuments({
    ...query,
    operationDays: {
      $in: dates
    }
  }).sort({departureTime: 1}).toArray()

  return trips
}

function findFirstBus(trips) {
  return trips.length ? trips[0].departureTime : '-'
}

function findLastBus(trips) {
  return trips.length ? trips.slice(-1)[0].departureTime : '-'
}

async function getOperationDays(gtfsTimetables, query) {
  return await gtfsTimetables.distinct('operationDays', query)
}

async function generateFirstLastBusMap(gtfsTimetables, query) {
  let operationDays = await getOperationDays(gtfsTimetables, query)
  let parsedOperationDays = parseOperationDays(operationDays)

  let distantWeekdays = getDistantWeekdays(parsedOperationDays)
  let distantSaturday = [getDistantSaturday(parsedOperationDays)]
  let distantSunday = [getDistantSunday(parsedOperationDays)]

  let weekdayTrips = await findTripsForDates(gtfsTimetables, query, distantWeekdays)
  let saturdayTrips = await findTripsForDates(gtfsTimetables, query, distantSaturday)
  let sundayTrips = await findTripsForDates(gtfsTimetables, query, distantSunday)

  let weekdayFirstBus = findFirstBus(weekdayTrips)
  let saturdayFirstBus = findFirstBus(saturdayTrips)
  let sundayFirstBus = findFirstBus(sundayTrips)

  let weekdayLastBus = findLastBus(weekdayTrips)
  let saturdayLastBus = findLastBus(saturdayTrips)
  let sundayLastBus = findLastBus(sundayTrips)

  return {
    firstBus: {
      weekday: weekdayFirstBus,
      saturday: saturdayFirstBus,
      sunday: sundayFirstBus
    },
    lastBus: {
      weekday: weekdayLastBus,
      saturday: saturdayLastBus,
      sunday: sundayLastBus
    }
  }
}

function calculateFrequency(departureTimes) {
  if (departureTimes.length === 0) return {min: '-', max: '-'}
  if (departureTimes.length === 1) return {min: -1, max: -1}

  let headways = departureTimes.sort((a, b) => a - b).map((e, i, a) => {
    if (i === 0) return -100
    return e - a[i - 1]
  }).slice(1).sort((a, b) => a - b)

  return {
    min: headways[0],
    max: headways.slice(-1)[0]
  }
}

function generateFrequencyMapOnDate(trips, round=false) {
  let overallFrequency = {}
  let boundedFrequency = {}
  let bandDepartures = {}
  let bands = Object.keys(frequencyRanges)

  bands.forEach(name => {
    let bounds = frequencyRanges[name].map(e => e[0] * 60 + e[1])

    boundedFrequency[name] = bounds
    bandDepartures[name] = []
  })

  trips.forEach(trip => {
    let {departureTimeMinutes} = trip.stopTimings[0]

    let departureBand = bands.find(bandName => {
      let band = boundedFrequency[bandName]
      return band[0] <= departureTimeMinutes && departureTimeMinutes < band[1]
    })

    if (departureBand && !bandDepartures[departureBand].includes(departureTimeMinutes))
      bandDepartures[departureBand].push(departureTimeMinutes)
  })

  bands.forEach(band => {
    overallFrequency[band] = calculateFrequency(bandDepartures[band])
  })

  return overallFrequency
}

async function generateFrequencyMap(gtfsTimetables, query) {
  let operationDays = await getOperationDays(gtfsTimetables, query)
  let parsedOperationDays = parseOperationDays(operationDays)

  let distantWeekdays = getDistantWeekdays(parsedOperationDays)
  let distantSaturday = [getDistantSaturday(parsedOperationDays)]
  let distantSunday = [getDistantSunday(parsedOperationDays)]

  let saturdayTrips = await findTripsForDates(gtfsTimetables, query, distantSaturday)
  let sundayTrips = await findTripsForDates(gtfsTimetables, query, distantSunday)

  let indvWeekdayFrequencies = {}
  await async.forEach(distantWeekdays, async date => {
    let trips = await findTripsForDates(gtfsTimetables, query, [date])
    let frequency = generateFrequencyMapOnDate(trips)
    indvWeekdayFrequencies[date] = frequency
  })

  let weekdayFrequency = {}
  Object.keys(frequencyRanges).forEach(name => weekdayFrequency[name] = {min: [], max: []})

  Object.values(indvWeekdayFrequencies).forEach(freq => {
    Object.keys(freq).forEach(name => {
      if (freq[name].min) {
        weekdayFrequency[name].min.push(freq[name].min)
        weekdayFrequency[name].max.push(freq[name].max)
      }
    })
  })


  Object.keys(weekdayFrequency).forEach(name => {
    let has1Bus = !!weekdayFrequency[name].min.find(e => e === -1)
    let hasMultipleBus = !!weekdayFrequency[name].min.find(e => e !== -1)

    if (has1Bus && hasMultipleBus) {
      weekdayFrequency[name].min = weekdayFrequency[name].min.filter(e => e !== -1)
      weekdayFrequency[name].max = weekdayFrequency[name].max.filter(e => e !== -1)
    }

    weekdayFrequency[name].min = Math.round(weekdayFrequency[name].min.reduce((a, e) => a + e, 0) / weekdayFrequency[name].min.length) || '-'
    weekdayFrequency[name].max = Math.round(weekdayFrequency[name].max.reduce((a, e) => a + e, 0) / weekdayFrequency[name].max.length) || '-'
  })

  let saturdayFrequency = generateFrequencyMapOnDate(saturdayTrips, true)
  let sundayFrequency = generateFrequencyMapOnDate(sundayTrips, true)

  function check1Bus(frequencyMap) {
    Object.keys(frequencyMap).forEach(name => {
      if (frequencyMap[name].min === -1) {
        frequencyMap[name] = {
          min: '1 Bus',
          max: '1 Bus'
        }
      }
    })

    return frequencyMap
  }

  return {
    weekday: check1Bus(weekdayFrequency),
    saturday: check1Bus(saturdayFrequency),
    sunday: check1Bus(sundayFrequency)
  }
}

module.exports = {
  getDistantWeekdays,
  getDistantSaturday,
  getDistantSunday,
  getOperationDays,
  parseOperationDays,

  generateFirstLastBusMap,
  generateFrequencyMap
}
