const moment = require('moment')
require('moment-timezone')
moment.tz.setDefault('Australia/Melbourne')
const request = require('request-promise')

const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']

String.prototype.format = (function (i, safe, arg) {
  function format () {
    var str = this; var len = arguments.length + 1
    for (i = 0; i < len; arg = arguments[i++]) {
      safe = typeof arg === 'object' ? JSON.stringify(arg) : arg
      str = str.replace(RegExp('\\{' + (i - 1) + '\\}', 'g'), safe)
    }
    return str
  }
  format.native = String.prototype.format
  return format
}())

module.exports = {
  encodeName: name => name.toLowerCase().replace(/[^\w\d ]/g, '-').replace(/  */g, '-').replace(/--+/g, '-'),
  adjustRouteName: routeName => {
    let loopPostfix = ''
    if (routeName.toLowerCase().includes('clockwise')) {
      let hasAnti = routeName.toLowerCase().includes('anti')
      routeName = routeName.replace(/\(?(?:anti)? ?-? ?(?:clockwise)(?: loop)?\)?$/i, '')
      loopPostfix = ' ('
      if (hasAnti) loopPostfix += 'Anti-'
      loopPostfix += 'Clockwise Loop)'
    }

    routeName = routeName.replace(/via .+/, '')
      .replace(/ \(SMARTBUS.+/g, '')
      .replace(/  +/g, ' ')
      .replace(/(\w) *- *(\w)/g, '$1 - $2')
      .replace(/Railway Station/g, 'Station')
      .replace(/Station/g, 'Railway Station')
      .trim()

    return routeName + loopPostfix
  },
  adjustRawStopName: name => {
    let directionParts
    if (directionParts = name.match(/\/\((.*?)\) (.*?) \((.+)/)) {
      name = name.replace(/\/.+/, '/')
      let roadName = directionParts[2],
      direction = directionParts[1],
      remaining = directionParts[3]

      direction = direction[0].toUpperCase() + direction.slice(1).toLowerCase()

      name += `${roadName} - ${direction} (${remaining}`
    } else if (directionParts = name.match(/^\((.*?)\) ([^/]+)\/(.+)/)) {
      name = name.replace(/\/.+/, '/')
      let roadName1 = directionParts[2],
      remaining = directionParts[3],
      direction = directionParts[1]

      direction = direction[0].toUpperCase() + direction.slice(1).toLowerCase()

      name = `${roadName1} - ${direction}/${remaining}`
    } else if (directionParts = name.match(/\/(.*?) \((\w+)\) (.*?) \((.+)/)) {
      // canberra st/lorwhatver (north) st (docklands)
      name = name.replace(/\/.+/, '/')
      let roadName1 = directionParts[1].trim(),
      roadName2 = directionParts[3].trim(),
      direction = directionParts[2].trim(),
      remaining = directionParts[4].trim()

      direction = direction[0].toUpperCase() + direction.slice(1).toLowerCase()
      name += `${roadName1} ${roadName2} - ${direction} (${remaining}`
    } else if (directionParts = name.match(/(.*?) \((\w+)(?: Side)?\) (.*?)\//)) {
      //Albert (east) St/Stephensons Rd (Mount Waverley)
      name = name.replace(/.*?\//, '/')
      let roadName1 = directionParts[1].trim(),
      roadName2 = directionParts[3].trim(),
      direction = directionParts[2].trim()

      direction = direction[0].toUpperCase() + direction.slice(1).toLowerCase()
      name = `${roadName1} ${roadName2} - ${direction}` + name
    } else if (directionParts = name.match(/\((\w+)\)\//)) {
      // some st (south)/whatever rd (x)
      direction = directionParts[1]
      direction = direction[0].toUpperCase() + direction.slice(1).toLowerCase()

      name = name.replace(/\(\w+\)\//, ` - ${direction}/`)
    } else if (directionParts = name.match(/\((\w+)\) \(/)) {
      // some st/whatever rd (south) (x)
      direction = directionParts[1]
      direction = direction[0].toUpperCase() + direction.slice(1).toLowerCase()

      name = name.replace(/\((\w+)\) \(/, ` - ${direction} (`)
    }

    if (name.match(/\(([\w ]+) \((\d{4})\)\)$/)) {
      name = name.replace(/\(([\w ]+) \((\d{4})\)\)$/, '($1: $2)')
    }

    return name.replace(/  +/g, ' ')
  },
  adjustStopname: name => {
    if (name.includes('Jolimont-MCG')) {
      name = name.replace('Jolimont-MCG', 'Jolimont')
    }
    if (name.includes('Jolimont Station-MCG')) {
      name = name.replace('Jolimont Station-MCG', 'Jolimont Station')
    }
    if (name.includes(' Railway Station')) {
      name = name.replace(' Railway Station', ' Station')
    }

    let expandStation = !(
         name.includes('Police Station') || name.includes('Service Station')
      || name.includes('Fire Station') || name.includes('Petrol Station')
      || name.includes('Caltex Station') || name.match(/Station (St|Rd)/)
      || name.match(/CFA (Fire )?Station/) || name.match(/[\d]+\w? Station/)
    )

    let isBusStation = name.includes('Bus Station')

    if (name.includes(' Station') && !isBusStation && (expandStation || name.match(/Station\/Station/))) {
      name = name.replace(' Station', ' Railway Station')
    }

    name = name.replace('Schhol', 'School')

    return name.replace(/  +/g, ' ').replace(' SC', ' Shopping Centre')
  },
  shorternStopName: name => {
    name = name.replace('Railway Station', 'RS')
      .replace('Shopping Centre', 'SC')
      .replace('University', 'Uni')
      .replace('Road', 'Rd')
      .replace('Street', 'St')
      .replace('Ferntree', 'FT')
      .replace('South', 'Sth')
      .replace('North', 'Nth')
      .replace('Gardens', 'Gdns')
      .replace(/\/.+/, '')
    if (name === 'Monash Uni Bus Loop')
      name = 'Monash Uni'

    return name
  },
  extractStopName: name => {
    return name.replace(/\/[^\/]*?$/, '')
  },
  parseGTFSData: data =>
    data.split('\r\n').slice(1).filter(Boolean).map(e => e.match(/"([^"]*)"/g).map(f => f.slice(1, -1))),
  simplifyRouteGTFSID: id => id.replace(/(-[A-Za-z])?-mjp-1$/, ''),
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
    let minutesPastMidnight = module.exports.getMinutesPastMidnight(time)
    let offset = 0

    if (minutesPastMidnight < 180) offset = 1440

    return daysOfWeek[time.clone().subtract(offset, 'minutes').day()]
  },
  getDayName: time => {
    return daysOfWeek[time.day()]
  },
  isWeekday: dayOfWeek => {
    return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri'].includes(dayOfWeek)
  },
  formatPTHHMM: time => {
    let hours = time.get('hours'),
      minutes = time.get('minutes')
    if (hours < 3) hours += 24
    return `${module.exports.pad(hours, 2)}:${module.exports.pad(minutes, 2)}`
  },
  correctHHMMToPT: time => {
    const parts = time.slice(0, 5).split(':')
    let hours = parts[0] * 1,
      minutes = parts[1]
    if (hours < 3) hours += 24

    return `${module.exports.pad(hours, 2)}:${module.exports.pad(minutes, 2)}`
  },
  getYYYYMMDD: time => {
    let cloned = time.clone()
    if (cloned.get('hours') < 3) // 3am PT day :((((
      cloned.add(-1, 'days')
    return cloned.format('YYYYMMDD')
  },
  getYYYYMMDDNow: () => module.exports.getYYYYMMDD(module.exports.now()),
  now: () => moment.tz('Australia/Melbourne'),
  request: async (...options) => {
    let start = +new Date()

    let body = await request(...options)

    let url = typeof options[0] === 'string' ? options[0] : options[0].url

    let end = +new Date()
    let diff = end - start
    console.log(`${diff}ms ${url}`)

    return body
  },
  isStreet: shortName => {
    return (shortName.endsWith('St') || shortName.endsWith('Rd')
      || shortName.endsWith('Pde') || shortName.endsWith('Cl')
      || shortName.endsWith('Dr') || shortName.endsWith('Ave')
      || shortName.endsWith('Gr') || shortName.endsWith('Ct')
      || shortName.endsWith('Hwy') || shortName.endsWith('Tce')
      || shortName.endsWith('Wat') || shortName.endsWith('Cl')
      || shortName.endsWith('Crst') || shortName.endsWith('Pl')
      || shortName.endsWith('Bvd') || shortName.endsWith('Cres'))
  },
  isCheckpointStop: stopName => stopName.includes('University')
    || stopName.includes('Railway Station')
    || stopName.includes('SC') || stopName.includes('Shopping Centre'),

  getDistanceFromLatLon: (lat1, lon1, lat2, lon2) => {
    var R = 6371 // Radius of the earth in km
    var dLat = module.exports.deg2rad(lat2-lat1)
    var dLon = module.exports.deg2rad(lon2-lon1)
    var a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(module.exports.deg2rad(lat1)) * Math.cos(module.exports.deg2rad(lat2)) *
      Math.sin(dLon/2) * Math.sin(dLon/2)

    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    var d = R * c // Distance in km
    return Math.floor(d * 1000) // distance in m
  },
  deg2rad: deg => {
    return deg * (Math.PI/180)
  },
  titleCase: str => str.replace(/\w\S*/g, txt => {
    if (txt.length > 2)
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    return txt
  }).replace(/\S*\w/g, txt => {
    let punctuation = (txt.match(/(\S*)/)||[,''])[1]
    let text = txt.slice(punctuation.length)
    if (text.length > 2)
      return punctuation + text.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()

    return txt
  })
}
