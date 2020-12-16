const moment = require('moment')
require('moment-timezone')
const utils = require('./utils')

module.exports = {
  splitLine: line => line.match(/"([^"]*)"/g).map(f => f.slice(1, -1)),
  calendarToDates: (calendar, calendarDates, service) => {
    let calendarLine = calendar.find(line => line[0] == service)
    calendarDates = calendarDates.filter(line => line[0] == service).reduce((a, line) => {
      a[line[1]] = line[2]
      return a
    }, {})

    let operationDays = calendarLine.slice(1, 8)
    operationDays = operationDays.slice(6).concat(operationDays.slice(0, 6))
    let startDate = utils.parseDate(calendarLine[8])
    let endDate = utils.parseDate(calendarLine[9])

    let allDatesInbetween = utils.allDaysBetweenDates(startDate, endDate)
      .filter(date => operationDays[date.day()] === '1')
      .filter(date => calendarDates[utils.getYYYYMMDD(date)] !== '2')

    Object.keys(calendarDates).forEach(date => {
      if (calendarDates[date] === 1) {
        allDatesInbetween.push(utils.parseDate(date))
      }
    })

    return allDatesInbetween.sort((a, b) => +a - +b)
  },
  simplifyRouteGTFSID: id => id.replace(/^(\d\d?-\w{1,3}).+$/, '$1'),
  parseGTFSData: data =>
    data.split('\n').slice(1).filter(Boolean).map(e => e.trim().match(/"([^"]*)"/g).map(f => f.slice(1, -1))),
}
