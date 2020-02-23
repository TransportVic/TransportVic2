const moment = require('moment')
const async = require('async')

let frequencyRanges = {
  'Early Morning': [[0, 0], [6, 00]],
  'Morning Peak': [[6, 00], [10, 0]],
  'Afternoon': [[10, 0], [16, 30]],
  'Evening Peak': [[16, 30], [20, 30]],
  'Night': [[20, 30], [24, 0]]
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

function splitDeparturesIntoFrequencyBands(bands, departureTimes) {
  let departureBands = {}
  Object.keys(bands).forEach(bandName => {
    departureBands[bandName] = []
  })
  departureTimes.forEach(departureTime => {
    let departureBand = Object.keys(bands).find(bandName => {
      let band = bands[bandName]
      return band[0] <= departureTime && departureTime < band[1]
    })
    departureBands[departureBand].push(departureTime)
  })
  return departureBands
}

function calculateFrequency(departureTimes) {
  let headways = departureTimes.map((e, i, a) => {
    if (i === 0) return -1
    return e - a[i - 1]
  }).slice(1).sort((a, b) => a - b)

  if (departureTimes.length == 1) return {min: -1, max: -1}

  return {
    min: headways[0],
    max: headways.slice(-1)[0]
  }
}

function generateFrequencyMapOnDate(stopList, trips) {
  let stops = {}
  let overallFrequency = {}

  Object.keys(frequencyRanges).map(name => {
    overallFrequency[name] = []
  })

  trips.forEach(trip => {
    trip.stopTimings.slice(0, -1).forEach(stop => {
      let {stopGTFSID, departureTimeMinutes} = stop
      if (!departureTimeMinutes) return
      if (!stops[stopGTFSID]) stops[stopGTFSID] = []
      stops[stopGTFSID].push(departureTimeMinutes)
    })
  })

  let boundedFrequency = {}

  Object.keys(frequencyRanges).map(name => {
    let bounds = frequencyRanges[name]
    bounds = bounds.map(e => e[0] * 60 + e[1])
    boundedFrequency[name] = bounds
  })

  Object.keys(stops).forEach(stopGTFSID => {
    let departureTimes = stops[stopGTFSID]
    stops[stopGTFSID] = splitDeparturesIntoFrequencyBands(boundedFrequency, departureTimes)
    Object.keys(stops[stopGTFSID]).forEach(bandName => {
      let frequency = calculateFrequency(stops[stopGTFSID][bandName])
      if (frequency.min)
        overallFrequency[bandName].push(frequency)
    })
  })

  Object.keys(overallFrequency).forEach(bandName => {
    let frequencies = overallFrequency[bandName]
    let finalFrequency = {
      min: [],
      max: []
    }
    frequencies.forEach(frequency => {
      finalFrequency.min.push(frequency.min)
      finalFrequency.max.push(frequency.max)
    })

    finalFrequency.min = finalFrequency.min.reduce((a, e) => a + e, 0) / frequencies.length
    finalFrequency.max = finalFrequency.max.reduce((a, e) => a + e, 0) / frequencies.length

    overallFrequency[bandName] = finalFrequency
  })

  return overallFrequency
}

async function generateFrequencyMap(gtfsTimetables, query, stopList) {

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
    let frequency = generateFrequencyMapOnDate(stopList, trips)
    indvWeekdayFrequencies[date] = frequency
  })

  let weekdayFrequency = {}
  Object.keys(frequencyRanges).forEach(name => weekdayFrequency[name] = {min: [], max: []})

  Object.values(indvWeekdayFrequencies).forEach(freq => {
    Object.keys(freq).forEach(name => {
      weekdayFrequency[name].min.push(freq[name].min)
      weekdayFrequency[name].max.push(freq[name].max)
    })
  })

  Object.keys(weekdayFrequency).forEach(name => {
    weekdayFrequency[name].min = Math.round(weekdayFrequency[name].min.reduce((a, e) => a + e, 0) / weekdayFrequency[name].min.length)
    weekdayFrequency[name].max = Math.round(weekdayFrequency[name].max.reduce((a, e) => a + e, 0) / weekdayFrequency[name].max.length)
  })
  let saturdayFrequency = generateFrequencyMapOnDate(stopList, saturdayTrips)
  let sundayFrequency = generateFrequencyMapOnDate(stopList, sundayTrips)

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
