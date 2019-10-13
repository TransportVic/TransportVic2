const moment = require('moment')
require('moment-timezone')

const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

module.exports = {
  encodeName: name => name.toLowerCase().replace(/[^\w\d ]/g, '-').replace(/  */g, '-').replace(/--+/g, '-'),
  adjustRawStopName: name => {
    let directionParts
    if (directionParts = name.match(/\/(.*?) \((\w+)\) (.*?) \((.+)/)) {
      name = name.replace(/\/.+/, '/')
      let roadName1 = directionParts[1].trim(),
      roadName2 = directionParts[3].trim(),
      direction = directionParts[2].trim(),
      remaining = directionParts[4]

      direction = direction[0].toUpperCase() + direction.slice(1).toLowerCase()
      name += `${roadName1} ${roadName2} - ${direction} (${remaining}`
    }

    if (name.match(/\(([\w ]+) \((\d{4})\)\)$/)) {
      name = name.replace(/\(([\w ]+) \((\d{4})\)\)$/, '($1: $2)')
    }

    return name
  },
  adjustStopname: name => {
    if (name.includes('Jolimont-MCG')) {
      name = name.replace('Jolimont-MCG', 'Jolimont')
    }
    if (name.includes('Railway Station')) {
      name = name.replace('Railway Station', 'Station');
    }

    if (name.includes('Station') && !name.includes('Bus Station')) {
      name = name.replace('Station', 'Railway Station')
    }

    return name
  },
  extractStopName: name => {
    return name.replace(/\/.+$/, '')
  },
  parseGTFSData: data =>
    data.split('\r\n').slice(1).filter(Boolean).map(e => e.match(/"([^"]*)"/g).map(f => f.slice(1, -1))),
  simplifyRouteGTFSID: id => id.replace(/(-\w)?-mjp-1$/, ''),
  pad: (data, length, filler='0') => Array(length).fill(filler).concat([...data.toString()]).slice(-length).join(''),
  allDaysBetweenDates: (startDate, endDate) => {
    startDate = startDate.clone().startOf('day').add(-1, 'days')
    endDate = endDate.startOf('day')

    let dates = []

    while(startDate.add(1, 'days').diff(endDate) <= 0) {
        dates.push(startDate.clone())
    }

    return dates
  },
  minutesAftMidnightToMoment: (minutes, day) => {
    return day.clone().startOf('day').set('hours', Math.floor(minutes / 60)).set('minutes', minutes % 60)
  },
  time24ToMinAftMidnight: time => {
    if (!time) return null
    const parts = time.slice(0, 5).split(':')
    return parts[0] * 60 + parts[1] * 1
  },
  getMinutesPastMidnightNow: () => {
    return module.exports.getMinutesPastMidnight(module.exports.now())
  },
  getPTMinutesPastMidnight: time => {
    let minutesPastMidnight = module.exports.getMinutesPastMidnight(time);
    let offset = 0;

    if (minutesPastMidnight < 180) offset = 1440;

    return minutesPastMidnight + offset
  },
  getMinutesPastMidnight: time => {
    return time.get('hours') * 60 + time.get('minutes')
  },
  getPTDayName: time => {
    let minutesPastMidnight = module.exports.getMinutesPastMidnight(time);
    let offset = 0;

    if (minutesPastMidnight < 180) offset = -1440;
    return daysOfWeek[time.clone().add(offset, 'minutes').day()]
  },
  getYYYYMMDD: time => time.format('YYYYMMDD'),
  getYYYYMMDDNow: () => module.exports.getYYYYMMDD(module.exports.now()),
  now: () => moment.tz('Australia/Melbourne')
}
