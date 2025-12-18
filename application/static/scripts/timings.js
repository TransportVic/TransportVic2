let stopDataCache
let departureTime = null

function setMap() {
  const main = $('div#map')
  if (!main) return

  if (window.innerWidth > 800) {
    const dataURL = $('#mapLink').href
    $('main#content').classList.add('map-enabled')
    generateMap('map', dataURL, true)
  } else {
    main.remove()
    $('#departures').classList.remove('map')
  }
}

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

    let id = stopData.cleanSuburbs + '/' + stopData.cleanName
    let existingStop = bookmarks.find(stop => stop.id === id)
    if (existingStop) {
      if (state) {
        if ( !existingStop.modes.includes(mode)) {
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

    let id = stopData.cleanSuburbs + '/' + stopData.cleanName
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

let lostFocusTime

function checkFocus() {
  if (document.hidden) {
    lostFocusTime = new Date()
  } else {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > 2 * 60 * 1000) {
      updateBody() // If user wasn't focused - update the timings as soon as they come back
    }
  }
}


function updateBody() {
  if (document.hidden) {
    let timeDiff = new Date() - lostFocusTime
    if (timeDiff > 2 * 60 * 1000) return
  }

  $.ajax({
    method: 'POST',
    data: departureTime === null ? {} : {
      departureTime: departureTime.toISOString()
    }
  }, (err, status, body) => {
    if (!err && status === 200) {
      $('#departures').innerHTML = body
      htmlData = body

      if ($('#textbar')) filterRuns($('#textbar').value.toLowerCase())
    }
  })
}

document.on('visibilitychange', checkFocus)

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

  const hasCombinedPicker = navigator.userAgent.includes('Chrome') || (navigator.userAgent.includes('Mobile') && navigator.userAgent.includes('Safari'))
  const clock = $('#clock')
  const dateTimePicker = $('#departureDateTime')
  if (dateTimePicker) {
    if (hasCombinedPicker && clock) {
      clock.on('click', () => dateTimePicker.showPicker())
      clock.on('keypress', e => {
        if (e.key === 'Enter') dateTimePicker.showPicker()
      })

      dateTimePicker.on('change', () => {
        departureTime = new Date(dateTimePicker.value)
        updateBody()
      })
    } else {
      const dropdown = $('#clockDropdown')
      const datePicker = $('#departureDate')
      const timePicker = $('#departureTime')

      dateTimePicker.style.display = 'none'

      const now = new Date()
      datePicker.value = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${(now.getDate()).toString().padStart(2, '0')}`
      timePicker.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

      let dropdownOpen = false
      const openClock = () => {
        if (dropdownOpen) return
        dropdown.classList.add('showing')
        dropdownOpen = true

        setTimeout(() => {
          const bodyClick = e => {
            let elem = e.target

            for (let i = 0; i < 3; i++) {
              if (!elem) break
              else if (elem === dropdown) return
              elem = elem.parentElement
            }

            cleanup()
          }

          const escape = e => {
            if (e.key === 'Escape') cleanup()
          }

          const update = () => {
            const departureDateParts = datePicker.value.match(/^(\d+)-(\d+)-(\d+)$/)
            const departureTimeParts = timePicker.value.match(/^(\d+):(\d+)$/)

            if (!departureDateParts || !departureTimeParts) return

            const [ year, month, day ] = departureDateParts.slice(1).map(v => parseInt(v))
            const [ hours, minutes ] = departureTimeParts.slice(1).map(v => parseInt(v))

            departureTime = new Date(year, month - 1, day, hours, minutes)
            cleanup()
            updateBody()
          }

          const listeners = [ ['body', 'click', bodyClick], ['body', 'keydown', escape], ['#confirmTime', 'click', update] ]
          for (const [target, type, fn] of listeners) $(target).on(type, fn)

          const cleanup = () => {
            dropdown.classList.remove('showing')
            dropdownOpen = false
            for (const [target, type, fn] of listeners) $(target).removeEventListener(type, fn)
          }
        }, 10)
      }

      clock.on('click', openClock)
      clock.on('keypress', e => {
        if (e.key === 'Enter') openClock()
      })
    }
  }

  setInterval(updateBody, 30 * 1000)
  checkFocus()

  setMap()
})
