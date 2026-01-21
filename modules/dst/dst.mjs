import moment from 'moment-timezone'
moment.tz.setDefault('Australia/Melbourne')

function isDSTChange(date) {
  return getTimeOffset(date) !== 0
}

function getTimeOffset(date) {
  let givenDay = moment(date).startOf('day').add(5, 'hours')
  let previousDay = givenDay.clone().add(-1, 'day')

  let previousUTCOffset = previousDay.utcOffset()
  let givenUTCOffset = givenDay.utcOffset()

  return previousUTCOffset - givenUTCOffset
}

function getDSTMinutesPastMidnight(time) {
  let givenTime = moment(time)
  let startOfDay = givenTime.clone().startOf('day')
  return givenTime.diff(startOfDay, 'minutes')
}

function getNonDSTMinutesPastMidnight(time) {
  let givenTime = moment(time)
  return givenTime.hours() * 60 + givenTime.minutes()
}

function getMinutesInDay(date) {
  let startOfDay = moment(date).startOf('day')
  let nextDay = startOfDay.clone().add(1, 'day')

  return nextDay.diff(startOfDay, 'minutes')
}

export {
  isDSTChange,
  getTimeOffset,
  getNonDSTMinutesPastMidnight,
  getDSTMinutesPastMidnight,
  getMinutesInDay
}