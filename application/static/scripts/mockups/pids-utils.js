/*

FSS Escalator {
  MAX_COLUMNS: 2,
  MIN_COLUMN_SIZE: 5,
  MAX_COLUMN_SIZE: 22
}

FSS Platform {
  MAX_COLUMNS: 4,
  CONNECTION_LOSS: 2,
  MIN_COLUMN_SIZE: 5,
  MAX_COLUMN_SIZE: 11
}

Suburban Platform {
  MAX_COLUMNS: 4,
  CONNECTION_LOSS: 2,
  MIN_COLUMN_SIZE: 5,
  MAX_COLUMN_SIZE: 10
}

*/

window.calculateLineNumber = function calculateLineNumber(stationsCount, hasConnections, options) {
  let MAX_COLUMNS = options.MAX_COLUMNS
  let CONNECTION_LOSS = options.CONNECTION_LOSS
  let MIN_COLUMN_SIZE = options.MIN_COLUMN_SIZE
  let MAX_COLUMN_SIZE = options.MAX_COLUMN_SIZE

  // total stations with extras due to spillover from space lost due to connection message - 2 per row * last 3 rows = 6
  let totalStations = stationsCount + (hasConnections ? (MAX_COLUMNS - 1) * CONNECTION_LOSS : 0)

  for (let columnSize = MIN_COLUMN_SIZE; columnSize <= MAX_COLUMN_SIZE; columnSize++) {
    if (MAX_COLUMNS * columnSize >= totalStations) {
      return Math.floor((columnSize + MAX_COLUMN_SIZE) / 2)
    }
  }

  return MAX_COLUMN_SIZE // will probably spill but its fine - theres a reason some spots don't have a list PIDS
}

window.splitStops = function splitStops(stops, hasConnections, options) {
  let size = calculateLineNumber(stops.length, hasConnections, options)

  let parts = []

  let start = 0
  for (let i = 0; true; i++) {
    let end = start + size
    if (hasConnections) {
      end -= i * options.CONNECTION_LOSS
    }

    let part = stops.slice(start, end)
    if (part.length === 0) return {stopColumns: parts, size}
    parts.push(part)
    start = end
  }
}
window.formatTime = function(time, options={}) {
  let fullOptions = {
    includeSeconds: false,
    use24: false,
    showAMPM: false,
    spaceBeforeAMPM: false,
    padZero: false,
    ...options
  }

  let hours = time.getHours()
  let minutes = time.getMinutes()
  let seconds = time.getSeconds()
  let mainTime = ''

  if (options.use24) {
    mainTime += options.padZero ? `${hours < 10 ? '0' : ''}${hours}` : hours
  } else {
    let h12 = (hours % 12) || 12
    mainTime += options.padZero ? `${h12 < 10 ? '0' : ''}${h12}` : h12
  }

  mainTime += `:${minutes < 10 ? '0' : ''}${minutes}`
  if (options.includeSeconds) mainTime += `:${seconds < 10 ? '0' : ''}${seconds}`

  if (options.showAMPM && !options.use24) {
    if (options.spaceBeforeAMPM) mainTime += ' '
    mainTime += (hours >= 12) ? 'pm' : 'am'
  }

  return mainTime
}

window.encode = name => name.toLowerCase().replace(/[^\w\d ]/g, '-').replace(/  */g, '-')

window.rawMinutesToDeparture = function (time) {
  let now = new Date()
  let diff = (time - now) / 1000 / 60
  if (diff <= 0.5) return 0
  else return Math.round(diff)
}

window.minutesToDeparture = function (time, upp) {
  let diff = rawMinutesToDeparture(time)

  if (diff === 0) return upp ? 'NOW' : 'Now'
  else return diff + ' min'
}
