import moment from 'moment-timezone'
import stopNameModifier from './additional-data/stop-name-modifier.mjs'
import TimedCache from './TimedCache.mjs'
import EventEmitter from 'events'
import crypto from 'crypto'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'

import { spawn } from 'child_process'
import util from 'util'
import fetch from 'node-fetch'

moment.tz.setDefault('Australia/Melbourne')
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const locks = {}, caches = {}

let forceLongRequest = true
let interval = setInterval(() => {
  if (utils.uptime() >= 40000) {
    forceLongRequest = false
    clearInterval(interval)

    // if (global.loggers) global.loggers.fetch.log('Stopping long request timeout')
    // else console.log('Stopping long request timeout')
  }
}, 3000)
interval.unref()

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

const utils = {
  encodeName: name => name.toLowerCase().replace(/[^\w\d ]/g, '-').replace(/  */g, '-').replace(/--+/g, '-').replace(/-$/, '').replace(/^-/, ''),
  adjustRouteName: routeName => {
    return utils.titleCase(routeName.replace(/via .+/i, '')
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

    name = utils.expandStopName(name)

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
    .replace(/ Ave?(\b)/g, ' Avenue$1') // Cannot be at the start of a stop name, eg Ave Maria College
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
    .replace(/Devn(\b)/g, 'Deviation$1')
    .replace(/Sec Col(\b)/g, 'Secondary College$1')
    .replace(/Sec College(\b)/g, 'Secondary College$1')
    .replace(/Rec Res(\b)/g, 'Rec Reserve$1')
    .replace(/SC Senior Campus(\b)/g, 'Secondary College Senior Campus$1')
    .replace(/([\w ]*?) ?- ?([\w ]*?) Road/g, '$1-$2 Road')
    .replace(/St(\b)/, 'St.$1')
    .replace('St..', 'St. ')
    .replace('Ret Village', 'Retirement Village')
    .replace(/ SC(\b)/, ' Shopping Centre$1')
    .replace(/ RS(\b)/, ' Railway Station$1')
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
  adjustPTHHMM: time => {
    const parts = time.slice(0, 5).split(':')
    const [ hours, minutes ] = parts
    if (hours < 3) return `${parseInt(hours) + 24}:${minutes}`
    return time
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
  getPTHHMMFromMinutesPastMidnight: time => {
    let hours = Math.floor(time / 60)
    let minutes = time % 60
    let mainTime = ''

    if (hours < 10) mainTime += '0'
    mainTime += hours
    mainTime += ':'
    if (minutes < 10) mainTime += '0'
    mainTime += minutes

    return mainTime
  },
  getMinutesPastMidnightNow: () => {
    return utils.getMinutesPastMidnight(utils.now())
  },
  getPTMinutesPastMidnight: time => {
    let minutesPastMidnight = utils.getMinutesPastMidnight(time)
    let offset = 0

    if (minutesPastMidnight < 180) offset = 1440

    return minutesPastMidnight + offset
  },
  getMinutesPastMidnight: time => {
    return time.get('hours') * 60 + time.get('minutes')
  },
  getPTDayName: time => {
    let minutesPastMidnight = utils.getMinutesPastMidnight(time)
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
  isNightNetworkDay: dayOfWeek => {
    return ['Fri', 'Sat'].includes(dayOfWeek)
  },
  formatHHMM: time => { // TODO: Rename getHHMM
    return time.format('HH:mm')
  },
  formatPTHHMM: time => { // TODO: Rename getHHMM
    let hours = time.get('hours')
    let hour = time.format('HH')
    if (hours < 3) {
      let startOfPTDay = time.clone().startOf('day').add(-1, 'day')
      hour = time.diff(startOfPTDay, 'hours')
      return `${hour}:${time.format('mm')}`
    }

    return time.format('HH:mm')
  },
  formatPTHHMMForOpDay: (time, operationDay) => {
    if (time.clone().startOf('day') - operationDay.clone().startOf('day') === 0) return time.format('HH:mm')
    const hour = time.diff(operationDay, 'hours')
    return `${hour}:${time.format('mm')}`
  },
  getPTYYYYMMDD: time => {
    let cloned = time.clone()
    if (cloned.get('hours') < 3) // 3am PT day :((((
      cloned.add(-1, 'days')
    return cloned.format('YYYYMMDD')
  },
  getYYYYMMDD: time => {
    return time.format('YYYYMMDD')
  },
  getYYYYMMDDNow: () => utils.getYYYYMMDD(utils.now()),
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

    let diff = (+new Date()) - start
    let logMessage = `${diff}ms ${url}`

    if (!body && error) {
      if (error.message && error.message.toLowerCase().includes('network timeout')) {
        let totalTime = fullOptions.timeout * maxRetries
        logMessage = `${totalTime}ms ${url}`
        error.timeoutDuration = totalTime
      }

      if (global.loggers) global.loggers.fetch.log(logMessage)
      else console.log(logMessage)

      throw error
    }

    if (body && body.status.toString()[0] !== '2') {
      let err = new Error('Bad Request Status')
      err.status = body.status
      err.response = await (options.raw ? body.buffer() : body.text())
      if (global.loggers) global.loggers.fetch.log(logMessage)
      else console.log(logMessage)
      throw err
    }

    let size = body.headers.get('content-length')
    if (options.stream) {
      if (global.loggers) global.loggers.fetch.log(logMessage)
      else console.log(logMessage)

      return body.body
    }
    let returnData = await (options.raw ? body.buffer() : body.text())
    if (!size) size = returnData.length

    logMessage = `${diff}ms ${url} ${size}R`
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
    var dLat = utils.deg2rad(lat2-lat1)
    var dLon = utils.deg2rad(lon2-lon1)
    var a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(utils.deg2rad(lat1)) * Math.cos(utils.deg2rad(lat2)) *
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
    if (date instanceof Date) return utils.parseTime(date)

    if (date.match(/^\d{1,2}\/\d{1,2}\/\d{1,4}$/)) return utils.parseTime(date, 'DD/MM/YYYY')
    else return utils.parseTime(date, 'YYYYMMDD')
  },
  prettyTime: (time, showHours, blankOld) => {
    time = utils.parseTime(time)
    let timeDifference = moment.utc(time.diff(utils.now()))

    if (blankOld && +timeDifference <= -60000 * 2) return ''
    if (+timeDifference <= 60000) return 'Now'
    if (+timeDifference > 1440 * 60 * 1000) return utils.getHumanDateShort(time)

    let hours = timeDifference.get('hours')
    let minutes = timeDifference.get('minutes')
    let prettyTime = ''

    let minutesToDeparture = hours * 60 + minutes
    if (!showHours && minutesToDeparture > 180) {
      prettyTime += hours + ' h'
    } else if (showHours) {
      if (hours) prettyTime += hours + ' h '
      if (minutes) prettyTime += minutes + ' min'
    } else {
      prettyTime = minutesToDeparture + ' m'
    }

    return prettyTime.trim()
  },
  findHeadwayDeviance: (scheduledDepartureTime, estimatedDepartureTime, thresholds, isCancelled = false) => {
    if (!estimatedDepartureTime || isCancelled) return 'unknown'
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
    return utils.adjustRawStopName(stopNameModifier(utils.adjustStopName(ptvStopName.trim().replace(/ #.+$/, '').replace(/^(D?[\d]+[A-Za-z]?)-/, ''))))
  },
  getShortName: stopName => stopName.replace('Shopping Centre', 'SC').replace('Railway Station', 'Station'),
  getDestinationName: stopName => {
    let shortName = utils.getShortName(stopName)

    let primaryStopName = utils.getStopName(shortName)
    if (utils.isStreet(primaryStopName)) return shortName
    else return primaryStopName
  },
  getRunID: ptvRunID => {
    let parts
    if (parts = ptvRunID.toString().match(/^9(\d\d)(\d\d\d)$/)) {
      return `${String.fromCharCode(parseInt(parts[1]))}${parts[2]}`
    }
  },
  getPTVRunID: runID => {
      if (utils.isValidRunID(runID)) {
        return `9${runID.charCodeAt(0)}${runID.slice(1)}`
      } else return null
  },
  isValidRunID: runID => {
    return !!runID.match(/^\w\d{3}$/)
  },
  sleep: time => {
    return new Promise(resolve => {
      setTimeout(resolve, time)
    })
  },
  findSubstrings: (str, size=0) => {
    if (str.length < size) return [str]

    let result = []
    for (let i = 0; i < str.length; i++) {
      for (let j = str.length; j - i >= size; j--) {
        result.push(str.slice(i, j))
      }
    }

    return result
  },
  tokeniseAndSubstring: text => {
    let words = text.split(/[^\w]/)
    return words.map(w => utils.findSubstrings(w, 4)).reduce((a, e) => a.concat(e), [])
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
      if (global.loggers) global.loggers.general.err('Getting data for', lock, 'for key', key, 'failed', e)
      else console.error('Getting data for', lock, 'for key', key, 'failed', e)
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
  },
  spawnProcess: async (path, args, finish) => {
    return await new Promise(resolve => {
      let childProcess = spawn(path, args)

      childProcess.stdout.on('data', data => {
        process.stdout.write(data.toString())
      })

      childProcess.stderr.on('data', data => {
        process.stderr.write(data.toString())
      })

      childProcess.on('close', code => {
        resolve()
      })
    })
  },
  walkDir: dir => {
    return new Promise((resolve, reject) => {
      let results = []
      let dirs = []
      fs.readdir(dir, async function(err, list) {
        if (err) return reject(err)
        let i = 0
        function next() {
          let file = list[i++]
          if (!file) {
            results = results.concat(dirs)
            return resolve(results)
          }

          file = path.resolve(dir, file)
          fs.stat(file, async function(err, stat) {
            if (stat && stat.isDirectory()) {
              dirs.push({file: false, path: file})
              results = results.concat(await utils.walkDir(file))
              next()
            } else {
              results.push({file: true, path: file})
              next()
            }
          })
        }
        next()
      })
    })
  },
  rmDir: async dir => {
    let allFiles = await utils.walkDir(dir)

    for (let file of allFiles) {
      try {
        if (file.file) await new Promise(resolve => fs.unlink(file.path, resolve))
        else await new Promise(resolve => fs.rmdir(file.path, resolve))
      } catch (err) {}
    }

    await new Promise(resolve => fs.rmdir(dir, resolve))
  },
  findLastIndex: (arr, func) => {
    return arr.reduce((prev, curr, index) => func(curr) ? index : prev, -1);
  },
  inspect: e => console.log(util.inspect(e, { depth: null, colors: true, maxArrayLength: null })),
  chunkText: (text, maxChunkSize) => {
    if (text.length <= maxChunkSize) return [[ text ]]
    let chunks = []

    let lines = text.split('\n')
    let currentChunk = []
    let currentLength = 0
    for (let i = 0; i < lines.length; i ++) {
      let currentLine = lines[i]
      if (currentLength + currentLine.length <= maxChunkSize) {
        currentChunk.push(currentLine)
        currentLength += currentLine.length + 1
      } else {
        chunks.push(currentChunk)
        currentChunk = [currentLine]
        currentLength = currentLine.length
      }
    }
    if (currentChunk) chunks.push(currentChunk)
    return chunks
  },
  setEnv: async () => {
    try {
      const env = (await fsp.readFile(path.join(__dirname, '.env'))).toString()
      const nodeEnv = env.match(/NODE_ENV=(.+)/)
      if (nodeEnv) process.env.NODE_ENV = nodeEnv[1].trim()
    } catch (e) {
    }
  },
  getPrettyStopName: (stopName, destinations, { routeNumber, routeGTFSID } = {}) => {
    const keyStopName = utils.getDestinationName(stopName)
    const primaryStopName = utils.getShortName(utils.getStopName(stopName))
    const serviceData = destinations.service[routeGTFSID] || destinations.service[routeNumber] || {}
    return (serviceData[keyStopName] || destinations.generic[keyStopName] || primaryStopName)
  }
}

export default utils