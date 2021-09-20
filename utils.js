const moment = require('moment')
require('moment-timezone')
moment.tz.setDefault('Australia/Melbourne')
const fetch = require('node-fetch')
const stopNameModifier = require('./additional-data/stop-name-modifier')
const TimedCache = require('./TimedCache')
const EventEmitter = require('events')
const crypto = require('crypto')

const daysOfWeek = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']
const locks = {}, caches = {}

let forceLongRequest = true
let interval = setInterval(() => {
  if (module.exports.uptime() >= 40000) {
    forceLongRequest = false
    clearInterval(interval)

    if (global.loggers) global.loggers.fetch.log('Stopping long request timeout')
    else console.log('Stopping long request timeout')
  }
}, 3000)

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
  encodeName: name => name.toLowerCase().replace(/[^\w\d ]/g, '-').replace(/  */g, '-').replace(/--+/g, '-').replace(/-$/, '').replace(/^-/, ''),
  adjustRouteName: routeName => {
    return module.exports.titleCase(routeName.replace(/via .+/i, '')
      .replace(/\(?(?:anti)? ?-? ?(?:clockwise)(?: loop)?\)?$/i, '')
      .replace(/ \(SMARTBUS.+/gi, '')
      .replace(/ to /i, ' - ')
      .replace(/  +/g, ' ')
      .replace(/(\w) *- *(\w)/g, '$1 - $2')
      .replace(/(?:Railway)? Station/gi, '')
      .replace(/ \((From|Until) .+\)$/i, '')
      .trim()
    )
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
      // Suburbs with duplicate names: newton, hillside
      name = name.replace(/\(([\w ]+) \((\d{4})\)\)$/, '($1: $2)')
    }

    if (name.match(/\(([\w ]+) \(\w+ - ([A-Z]{2,4})\)\)$/)) {
      // Suburbs in other states (Glenroy (Albury - NSW))
      name = name.replace(/\(([\w ]+) \(\w+ - ([A-Z]{2,4})\)\)$/, '($1, $2)')
    }

    if (name.match(/\(([\w ]+) \(([A-Z]{2,4})\)\)$/)) {
      // Suburbs in other states (Albury (NSW))
      name = name.replace(/\(([\w ]+) \(([A-Z]{2,4})\)\)$/, '($1, $2)')
    }

    return name.replace(/  +/g, ' ')
  },
  adjustStopName: name => {
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

    name = module.exports.expandStopName(name)

    return name
  },
  expandStopName: name => {
    name = name.replace(/St(\/|$)/g, 'Street$1')
    .replace(/St S(\b)/, 'Street South$1')
    .replace(/St N(\b)/, 'Street North$1')
    .replace(/(\w+) St(\b)/, '$1 Street$2')
    .replace(/St -/g, 'Street -')
    .replace(/Rd(\b)/g, 'Road$1')
    .replace(/Mt\.?(\b)/g, 'Mount$1')
    .replace(/Pde(\b)/g, 'Parade$1')
    .replace(/Cl(\b)/g, 'Close$1')
    .replace(/Dr(\b)/g, 'Drive$1')
    .replace(/Ave?(\b)/g, 'Avenue$1')
    .replace(/Gr(\b)/g, 'Grove$1')
    .replace(/Ct(\b)/g, 'Court$1')
    .replace(/Cr(\b)/g, 'Crescent$1')
    .replace(/Hwy(\b)/g, 'Highway$1')
    .replace(/Fwy(\b)/g, 'Freeway$1')
    .replace(/Tce(\b)/g, 'Terrace$1')
    .replace(/Crst(\b)/g, 'Crescent$1')
    .replace(/Pl(\b)/g, 'Place$1')
    .replace(/Bl?vd(\b)/g, 'Boulevard$1')
    .replace(/Cres(\b)/g, 'Crescent$1')
    .replace(/Crse(\b)/g, 'Crescent$1')
    .replace(/Ctr(\b)/g, 'Centre$1')
    .replace(/Lt(\b)/g, 'Little$1')
    .replace(/Lwr(\b)/g, 'Lower$1')
    .replace(/Prom(\b)/g, 'Promenade$1')
    .replace(/PS(\b)/g, 'Primary School$1')
    .replace(/Esp(\b)/g, 'Esplanade$1')
    .replace(/Cct(\b)/g, 'Circuit$1')
    .replace(/Mount\./g, 'Mount')
    .replace(/Sq(\b)/g, 'Square$1')
    .replace(/Sth(\b)/g, 'South$1')
    .replace(/Nth(\b)/g, 'North$1')
    .replace(/Gdn(s?)(\b)/g, 'Garden$1$2')
    .replace(/Cir(\b)/g, 'Circle$1')
    .replace(/Con(\b)/g, 'Concourse$1')
    .replace(/Ch(\b)/g, 'Chase$1')
    .replace(/Gra(\b)/g, 'Grange$1')
    .replace(/Grn(\b)/g, 'Green$1')
    .replace(/Gtwy(\b)/g, 'Gateway$1')
    .replace(/Uni(\b)/g, 'University$1')
    .replace(/Plza(\b)/g, 'Plaza$1')
    .replace(/Psge(\b)/g, 'Passage$1')
    .replace(/Rdge(\b)/g, 'Ridge$1')
    .replace(/Strp(\b)/g, 'Strip$1')
    .replace(/Tafe(\b)/g, 'TAFE$1')
    .replace(/Trk(\b)/g, 'Track$1')
    .replace(/Vsta(\b)/g, 'Vista$1')
    .replace(/Pkwy(\b)/g, 'Parkway$1')
    .replace(/Sec Col(\b)/g, 'Secondary College$1')
    .replace(/Rec Res(\b)/g, 'Rec Reserve$1')
    .replace(/SC Senior Campus(\b)/g, 'Secondary College Senior Campus$1')
    .replace(/([\w ]*?) ?- ?([\w ]*?) Road/g, '$1-$2 Road')
    .replace(/St(\b)/, 'St.$1')
    .replace('St..', 'St. ')
    .replace('Ret Village', 'Retirement Village')
    .replace(' SC', ' Shopping Centre')
    .replace(/Cresent/g, 'Crescent')

    return name.replace(/  +/g, ' ')
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
  getMomentFromMinutesPastMidnight: (minutes, day) => {
    return day.clone().startOf('day').set('hours', Math.floor(minutes / 60)).set('minutes', minutes % 60)
  },
  getMinutesPastMidnightFromHHMM: time => {
    if (!time) return null
    const parts = time.slice(0, 5).split(':')
    return parts[0] * 60 + parts[1] * 1
  },
  getHHMMFromMinutesPastMidnight: time => {
    let hours = Math.floor(time / 60)
    let minutes = time % 60
    let mainTime = ''

    hours %= 24
    if (hours < 10) mainTime += '0'
    mainTime += hours
    mainTime += ':'
    if (minutes < 10) mainTime += '0'
    mainTime += minutes

    return mainTime
  },
  getMinutesPastMidnightNow: () => {
    return module.exports.getMinutesPastMidnight(module.exports.now())
  },
  getPTMinutesPastMidnight: time => {
    let minutesPastMidnight = module.exports.getMinutesPastMidnight(time)
    let offset = 0

    if (minutesPastMidnight < 180) offset = 1440

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
  getDayOfWeek: time => {
    return daysOfWeek[time.day()]
  },
  isWeekday: dayOfWeek => {
    return ['Mon', 'Tues', 'Wed', 'Thur', 'Fri'].includes(dayOfWeek)
  },
  formatHHMM: time => { // TODO: Rename getHHMM
    return time.format('HH:mm')
  },
  getYYYYMMDD: time => {
    // let cloned = time.clone()
    // if (cloned.get('hours') < 3) // 3am PT day :((((
    //   cloned.add(-1, 'days')
    // return cloned.format('YYYYMMDD')
    return time.format('YYYYMMDD')
  },
  getYYYYMMDDNow: () => module.exports.getYYYYMMDD(module.exports.now()),
  getHumanDateShort: time => {
    return time.format('DD/MM')
  },
  getHumanDate: time => {
    return time.format('DD/MM/YYYY')
  },
  now: () => moment.tz('Australia/Melbourne'),
  parseTime: (time, format) => {
    if (format)
      return moment.tz(time, format, 'Australia/Melbourne')
    else
      return moment.tz(time, 'Australia/Melbourne')
  },
  request: async (url, options={}) => {
    let start = +new Date()

    let body
    let error

    let maxRetries = (options ? options.maxRetries : null) || 3

    let fullOptions = {
      timeout: 2000,
      compress: true,
      highWaterMark: 1024 * 1024,
      ...options
    }

    if (forceLongRequest) fullOptions.timeout = Math.max(fullOptions.timeout, 6000)

    for (let i = 0; i < maxRetries; i++) {
      try {
        body = await fetch(url, fullOptions)

        break
      } catch (e) {
        error = e
      }
    }

    if (!body && error) {
      if (error.message && error.message.toLowerCase().includes('network timeout')) {
        let totalTime = fullOptions.timeout * maxRetries
        let logMessage = `${totalTime}ms ${url}`
        if (global.loggers) global.loggers.fetch.log(logMessage)
        else console.log(logMessage)

        error.timeoutDuration = totalTime
      }
      throw error
    }

    let end = +new Date()
    let diff = end - start

    let size = body.headers.get('content-length')
    if (options.stream) {
      let logMessage = `${diff}ms ${url}`
      if (global.loggers) global.loggers.fetch.log(logMessage)
      else console.log(logMessage)

      return body.body
    }
    let returnData = await (options.raw ? body.buffer() : body.text())
    if (!size) size = returnData.length

    let logMessage = `${diff}ms ${url} ${size}R`
    if (global.loggers) global.loggers.fetch.log(logMessage)
    else console.log(logMessage)

    return returnData
  },
  isStreet: shortName => {
    return (shortName.endsWith('Street') || shortName.endsWith('Road')
      || shortName.endsWith('Parade') || shortName.endsWith('Close')
      || shortName.endsWith('Drive') || shortName.endsWith('Avenue')
      || shortName.endsWith('Grove') || shortName.endsWith('Court')
      || shortName.endsWith('Highway') || shortName.endsWith('Terrace')
      || shortName.endsWith('Way') || shortName.endsWith('Crescent')
      || shortName.endsWith('Place') || shortName.endsWith('Boulevard')
      || shortName.endsWith('Crescent') || shortName.endsWith('Freeway'))
      || shortName.endsWith('Lane')
  },
  isCheckpointStop: stopName => stopName.includes('University')
    || stopName.includes('Railway Station')
    || stopName.includes('Bus Station')
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
  titleCase: (str, anyLength=false) => str.replace(/\w\S*/g, txt => {
    if (txt.length > 2 || anyLength)
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    return txt
  }).replace(/\b\w/g, txt => {
    let punctuation = (txt.match(/(\b)/)||[,''])[1]
    let text = txt.slice(punctuation.length)
    if (text.length > 2 || anyLength)
      return punctuation + text.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()

    return txt
  }),
  uptime: () => process.uptime() * 1000,
  getStopName: stopName => {
    let parts = stopName.split('/')
    if (parts.length > 1)
      return parts.slice(0, -1).join('/')

    return stopName
  },
  parseDate: date => {
    if (date.match(/^\d{1,2}\/\d{1,2}\/\d{1,4}$/)) return module.exports.parseTime(date, 'DD/MM/YYYY')
    else return module.exports.parseTime(date, 'YYYYMMDD')
  },
  prettyTime: (time, showHours, blankOld) => {
    time = module.exports.parseTime(time)
    let timeDifference = moment.utc(time.diff(module.exports.now()))

    if (blankOld && +timeDifference <= -30000) return ''
    if (+timeDifference <= 60000) return 'Now'
    if (+timeDifference > 1440 * 60 * 1000) return module.exports.getHumanDateShort(time)

    let hours = timeDifference.get('hours')
    let minutes = timeDifference.get('minutes')
    let prettyTime = ''

    if (showHours) {
      if (hours) prettyTime += hours + ' h '
      if (minutes) prettyTime += minutes + ' min'
    } else {
      let minutesToDeparture = hours * 60 + minutes
      prettyTime = minutesToDeparture + ' m'
    }

    return prettyTime.trim()
  },
  findHeadwayDeviance: (scheduledDepartureTime, estimatedDepartureTime, thresholds) => {
    if (!estimatedDepartureTime) return 'unknown'
    let headwayDeviance = scheduledDepartureTime.diff(estimatedDepartureTime, 'seconds') / 60

    if (headwayDeviance > thresholds.early) {
      return 'early'
    } else if (headwayDeviance <= -thresholds.late) {
      return 'late'
    } else {
      return 'on-time'
    }
  },
  getProperStopName: ptvStopName => {
    return module.exports.adjustRawStopName(stopNameModifier(module.exports.adjustStopName(ptvStopName.trim().replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, ''))))
  },
  getDestinationName: stopName => {
    stopName = stopName.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station')

    let shortName = module.exports.getStopName(stopName)
    if (module.exports.isStreet(shortName)) return stopName
    else return shortName
  },
  getRunID: ptvRunID => {
    if (ptvRunID >= 988000) {
      return `X${module.exports.pad(ptvRunID - 988000, 3, '0')}`
    } else if (ptvRunID >= 982000) {
      return `R${module.exports.pad(ptvRunID - 982000, 3, '0')}`
    } else {
      return module.exports.pad(ptvRunID - 948000, 4, '0')
    }
  },
  getPTVRunID: runID => {
    if (parseInt(runID)) {
      return parseInt(runID) + 948000
    } else {
      if (runID[0] === 'X') return parseInt(runID.slice(1)) + 988000
      if (runID[0] === 'R') return parseInt(runID.slice(1)) + 982000
    }
  },
  sleep: time => {
    return new Promise(resolve => {
      setTimeout(resolve, time)
    })
  },
  findSubstrings: (str, size=0) => {
    let result = []
    for (let i = 0; i < str.length; i++) {
      for (let j = str.length; j - i >= size; j--) {
        result.push(str.slice(i, j))
      }
    }

    return result
  },
  tokeniseAndSubstring: text => {
    let words = text.split(' ')
    return words.map(w => module.exports.findSubstrings(w, 4)).reduce((a, e) => a.concat(e), [])
  },
  shuffle: a => {
    let j, x, i
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1))
      x = a[i]
      a[i] = a[j]
      a[j] = x
    }

    return a
  },
  getData: async (lock, key, noMatch, ttl=1000 * 60) => {
    if (!locks[lock]) locks[lock] = {}
    if (!caches[lock]) caches[lock] = new TimedCache(ttl)

    if (locks[lock][key]) {
      return await new Promise((resolve, reject) => {
        locks[lock][key].on('loaded', resolve)
        locks[lock][key].on('fail', e => {
          reject(e)
        })
      })
    }
    if (caches[lock].get(key)) {
      return caches[lock].get(key)
    }

    locks[lock][key] = new EventEmitter()
    locks[lock][key].setMaxListeners(1000)

    let data

    try {
      data = await noMatch()
    } catch (e) {
      global.loggers.general.err('Getting data for', lock, 'for key', key, 'failed', e)
      locks[lock][key].emit('fail', e)
      delete locks[lock][key]
      throw e
    }

    caches[lock].put(key, data)
    locks[lock][key].emit('loaded', data)
    delete locks[lock][key]

    if (ttl !== caches[lock].getTTL()) caches[lock].setTTL(ttl)

    return data
  },
  hash: data => {
    return crypto.createHash('md5').update(data).digest('hex')
  },
  tripsEqual: (tripA, tripB) => {
    return tripA.routeGTFSID === tripB.routeGTFSID
      && tripA.origin === tripB.origin
      && tripA.destination === tripB.destination
      && tripA.departureTime === tripB.departureTime
      && tripA.destinationArrivalTime === tripB.destinationArrivalTime
  }
}
