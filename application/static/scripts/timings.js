let stopDataCache

function getStopData(mode, suburb, stopName, callback) {
  if (stopDataCache) return callback(stopDataCache)
  $.ajax({
    url: `/stop-data?mode=${mode}&suburb=${suburb}&name=${stopName}`
  }, (err, status, data) => {
    stopDataCache = data
    callback(data)
  })
}

function setBookmarked(mode, suburb, stopName, state, callback) {
  getStopData(mode, suburb, stopName, stopData => {
    let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]')

    let id = stopData.codedSuburb + '/' + stopData.codedName
    let existingStop = bookmarks.find(stop => stop.id === id)
    if (existingStop) {
      if (state) {
        if (!existingStop.modes.includes(mode)) {
          existingStop.modes.push(mode)
        }
      } else {
        if (existingStop.modes.includes(mode)) {
          existingStop.modes.splice(existingStop.modes.indexOf(mode), 1)
        }
        if (existingStop.modes.length === 0) {
          bookmarks.splice(bookmarks.indexOf(existingStop), 1)
        }
      }
    } else {
      if (state) {
        bookmarks.push({
          stopData,
          modes: [mode],
          id
        })
      }
    }

    localStorage.setItem('bookmarks', JSON.stringify(bookmarks))
    callback()
  })
}

function isBookmarked(mode, suburb, stopName, callback) {
  getStopData(mode, suburb, stopName, stopData => {
    let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]')

    let id = stopData.codedSuburb + '/' + stopData.codedName
    let existingStop = bookmarks.find(stop => stop.id === id)
    if (existingStop) {
      callback(existingStop.modes.includes(mode))
    } else callback(false)
  })
}

let htmlData = $('#departures').innerHTML

function filterRuns(query) {
  $('#departures').innerHTML = htmlData
  Array.from($('#departures').querySelectorAll('.departure')).forEach(departureDiv => {
    const stopsAt = departureDiv.querySelector('[name=stops-at]').value.toLowerCase().split(',')
    const platform = departureDiv.querySelector('[name=platform]').value.toLowerCase()
    const line = departureDiv.querySelector('[name=line]').value.toLowerCase()

    let platformNumber = (platform.match(/(\d+)/) || ['', ''])[1]
    let platformEnd = (platform.match(/\d+([A-Za-z])$/) || ['', ''])[1]

    let platformMatches = query === platformNumber ||
      (platformEnd ? platform.startsWith(query.toLowerCase()) : false)

    if (!(stopsAt.filter(stop => stop.includes(query)).length || platformMatches || line.includes(query))) $('#departures').removeChild(departureDiv)
  })
}

let isFocused = true
let lostFocusTime

function checkFocus() {
  isFocused = document.hasFocus()
  if (!isFocused) {
    lostFocusTime = new Date()
  }
}

function updateBody() {
  if (!isFocused) {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > 5 * 60 * 1000) return
  }

  $.ajax({ method: 'POST' }, (err, status, body) => {
    if (!err && status === 200) {
      $('#departures').innerHTML = body
      htmlData = body

      if ($('#textbar'))
        filterRuns($('#textbar').value.toLowerCase())
    }
  })
}

document.on("visibilitychange", checkFocus)
window.on("focus", checkFocus)
window.on("blur", checkFocus)

$.ready(() => {
  if ($('#textbar')) {
    $('#textbar').on('input', () => {
      filterRuns($('#textbar').value.toLowerCase())
    })

    filterRuns($('#textbar').value.toLowerCase())
  }

  let stopData = location.pathname.slice(1).split('/')
  let mode, suburb, stopName
  mode = stopData.shift()
  stopData.shift()
  stopName = stopData.pop()
  suburb = stopData[0]

  if (mode === 'metro') mode = 'metro train'
  if (mode === 'vline') mode = 'regional train'
  if (mode === 'coach') mode = 'regional coach'
  if (mode === 'heritage') mode = 'heritage train'

  isBookmarked(mode, suburb, stopName, bookmarkStatus => {
    if (bookmarkStatus)
      $('#bookmark').src = '/static/images/decals/bookmark-filled.svg'
  })

  $('#bookmark').on('click', () => {
    isBookmarked(mode, suburb, stopName, bookmarkStatus => {
      setBookmarked(mode, suburb, stopName, !bookmarkStatus, () => {
        if (!bookmarkStatus)
          $('#bookmark').src = '/static/images/decals/bookmark-filled.svg'
        else
          $('#bookmark').src = '/static/images/decals/bookmark.svg'
      })
    })
  })

  setInterval(updateBody, 30 * 1000)
  checkFocus()
})
