const moment = require('moment')
require('moment-timezone')
const utils = require('./utils')

module.exports = {
  calendarToDates(calendar, calendarDates, service) {
    let calendarLine = calendar.filter(line => line[0] == service)[0]
    calendarDates = calendarDates.filter(line => line[0] == service).reduce((a, line) => {
      a[line[1]] = line[2]
      return a
    }, {})

    let operationDays = calendarLine.slice(1, 8)
    operationDays = operationDays.slice(6).concat(operationDays.slice(0,6))
    let startDate = moment.tz(calendarLine[8], 'YYYYMMDD', 'Australia/Melbourne')
    let endDate = moment.tz(calendarLine[9], 'YYYYMMDD', 'Australia/Melbourne')

    let allDatesInbetween = utils.allDaysBetweenDates(startDate, endDate)
      .filter(date => operationDays[date.day()] === '1')
      .filter(date => calendarDates[date.format('YYYYMMDD')] !== 2)

    Object.keys(calendarDates).forEach(date => {
      if (calendarDates[date] === 1) {
        allDatesInbetween.push(moment.tz(date, 'YYYYMMDD', 'Australia/Melbourne'))
      }
    })

    return allDatesInbetween.sort((a, b) => +a - +b)
  },
  simplifyRouteGTFSID: id => id.replace(/(-[A-Za-z0-9])?-mjp-1$/, '')
}
