import async from 'async'
import utils from '../../../../utils.mjs'
import { getPublicHolidayName } from '../../../../public-holidays.mjs'

let frequencyRanges = {
  'Early Morning': [[3, 0], [6, 0]],
  'Morning Peak': [[6, 0], [10, 0]],
  'Daytime Off Peak': [[10, 0], [15, 0]],
  'Afternoon Peak': [[15, 0], [19, 0]],
  'Early Evening': [[19, 0], [22, 0]],
  'Late Night': [[22, 0], [27, 0]]
}

function getDistantWeekdays(allAvailableDays) {
  let weekdays = allAvailableDays.filter(day => {
    let phName = getPublicHolidayName(day)
    if (phName) return false
    let dayOfWeek = day.day()

    return 0 < dayOfWeek && dayOfWeek < 5 // Exclude friday
  })
  let sorted = weekdays.sort((a, b) => a - b)
  let lastSeven = sorted.slice(0, 7)
  let seenDaysOfWeek = []

  let uniqueDays = lastSeven.filter(day => {
    let dayOfWeek = day.day()

    if (seenDaysOfWeek.includes(dayOfWeek)) return false
    seenDaysOfWeek.push(dayOfWeek)

    return true
  })

  return uniqueDays.map(day => {
    return utils.getYYYYMMDD(day)
  })
}

function getDistantSaturday(allAvailableDays) {
  let saturdays = allAvailableDays.filter(day => {
    let phName = publicHolidays.getPublicHolidayName(day)
    if (phName) return false

    let dayOfWeek = day.day()

    return dayOfWeek === 6
  })

  let sorted = saturdays.sort((a, b) => a - b)
  let firstThree = sorted.slice(0, 3)

  return firstThree.length ? firstThree[0].format('YYYYMMDD') : null
}

function getDistantSunday(allAvailableDays) {
  let sundays = allAvailableDays.filter(day => {
    let phName = publicHolidays.getPublicHolidayName(day)
    if (phName) return false

    let dayOfWeek = day.day()

    return dayOfWeek === 0
  })

  let sorted = sundays.sort((a, b) => a - b)
  let firstThree = sorted.slice(0, 3)

  return firstThree.length ? firstThree[0].format('YYYYMMDD') : null
}

function parseOperationDays(operationDays) {
  return operationDays.map(day => {
    return utils.parseTime(day, 'YYYYMMDD')
  })
}

async function findTripsForDates(gtfsTimetables, query, dates) {
  let mostCommonOrigin = (await gtfsTimetables.aggregate([{
      $match: {
        ...query,
        operationDays: {
          $in: dates
        }
      }
    }, {
      "$sortByCount": "$origin"
  }]).toArray())[0]

  if (!mostCommonOrigin) return []

  let trips = (await gtfsTimetables.findDocuments({
    ...query,
    origin: mostCommonOrigin._id,
    operationDays: {
      $in: dates
    }
  }).toArray()).map(trip => {
    let departureTimeMinutes = utils.getMinutesPastMidnightFromHHMM(trip.departureTime)
    if (departureTimeMinutes < 180) departureTimeMinutes += 1440
    return {
      departureTimeMinutes,
      trip
    }
  }).sort((a, b) => a.departureTimeMinutes - b.departureTimeMinutes).map(t => t.trip)

  return trips
}

function findFirstTrip(trips) {
  return trips.length ? trips[0].departureTime : '-'
}

function findLastTrip(trips) {
  return trips.length ? trips.slice(-1)[0].departureTime : '-'
}

async function getOperationDays(gtfsTimetables, query) {
  return await gtfsTimetables.distinct('operationDays', query)
}

async function generateFirstLastTripMap(gtfsTimetables, query) {
  let operationDays = await getOperationDays(gtfsTimetables, query)
  let parsedOperationDays = parseOperationDays(operationDays)

  let distantWeekdays = getDistantWeekdays(parsedOperationDays)
  let distantSaturday = [getDistantSaturday(parsedOperationDays)]
  let distantSunday = [getDistantSunday(parsedOperationDays)]

  let weekdayTrips = await findTripsForDates(gtfsTimetables, query, distantWeekdays)
  let saturdayTrips = await findTripsForDates(gtfsTimetables, query, distantSaturday)
  let sundayTrips = await findTripsForDates(gtfsTimetables, query, distantSunday)

  let weekdayFirstTrip = findFirstTrip(weekdayTrips)
  let saturdayFirstTrip = findFirstTrip(saturdayTrips)
  let sundayFirstTrip = findFirstTrip(sundayTrips)

  let weekdayLastTrip = findLastTrip(weekdayTrips)
  let saturdayLastTrip = findLastTrip(saturdayTrips)
  let sundayLastTrip = findLastTrip(sundayTrips)

  return {
    firstTrip: {
      weekday: weekdayFirstTrip,
      saturday: saturdayFirstTrip,
      sunday: sundayFirstTrip
    },
    lastTrip: {
      weekday: weekdayLastTrip,
      saturday: saturdayLastTrip,
      sunday: sundayLastTrip
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
    let has1Trip = !!weekdayFrequency[name].min.find(e => e === -1)
    let hasMultipleTrip = !!weekdayFrequency[name].min.find(e => e !== -1)

    if (has1Trip && hasMultipleTrip) {
      weekdayFrequency[name].min = weekdayFrequency[name].min.filter(e => e !== -1)
      weekdayFrequency[name].max = weekdayFrequency[name].max.filter(e => e !== -1)
    }

    weekdayFrequency[name].min = Math.round(weekdayFrequency[name].min.reduce((a, e) => a + e, 0) / weekdayFrequency[name].min.length) || '-'
    weekdayFrequency[name].max = Math.round(weekdayFrequency[name].max.reduce((a, e) => a + e, 0) / weekdayFrequency[name].max.length) || '-'
  })

  let saturdayFrequency = generateFrequencyMapOnDate(saturdayTrips, true)
  let sundayFrequency = generateFrequencyMapOnDate(sundayTrips, true)

  function check1Trip(frequencyMap) {
    Object.keys(frequencyMap).forEach(name => {
      if (frequencyMap[name].min === -1) {
        frequencyMap[name] = {
          min: '1 Trip',
          max: '1 Trip'
        }
      }
    })

    return frequencyMap
  }

  return {
    weekday: check1Trip(weekdayFrequency),
    saturday: check1Trip(saturdayFrequency),
    sunday: check1Trip(sundayFrequency)
  }
}

export default {
  getDistantWeekdays,
  getDistantSaturday,
  getDistantSunday,
  getOperationDays,
  parseOperationDays,

  generateFirstLastTripMap,
  generateFrequencyMap
}
