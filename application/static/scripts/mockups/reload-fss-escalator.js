let northernGroup = [
  'Craigieburn',
  'Sunbury',
  'Upfield',
  'Werribee',
  'Williamstown',
  'Showgrounds/Flemington'
]

let cliftonHillGroup = [
  'Hurstbridge',
  'Mernda'
]

let crossCityGroup = [
  'Werribee',
  'Williamstown',
  'Frankston'
]

let gippslandLines = [
  'Bairnsdale',
  'Traralgon'
]

let cityLoopStations = ['Southern Cross', 'Parliament', 'Flagstaff', 'Melbourne Central']

function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  if (time.getHours() >= 12)
    mainTime += 'pm'
  else
    mainTime += 'am'

  return mainTime
}

function getStoppingType(firstDeparture, isCityStop) {
  let stoppingType = firstDeparture.stoppingType

  if (isCityStop || firstDeparture.trip.direction === 'Up') {
    if (firstDeparture.additionalInfo.viaCityLoop) stoppingType += ' via City Loop'
    else {
      if (northernGroup.includes(firstDeparture.trip.routeName)) stoppingType += ' via Sthn Cross'
      else if (cliftonHillGroup.includes(firstDeparture.trip.routeName)) stoppingType += ' via Jolimont' //?
      else stoppingType += ' via Richmond'
    }
  }

  if (firstDeparture.type === 'vline') stoppingType = 'No Suburban Passengers'
  return stoppingType
}

function createStationRow(name, imgSource) {
  let style = 'height: 16px !important;'
  return `<div class="stationRow" style="${imgSource.includes('stub') ? style : ''}" data-name="${name}">`
  + (imgSource.includes('stub') ?
    `<img src="/static/images/mockups/station-${imgSource}.svg" height="16px" width="42px" style="${style}">`
  : `<img src="/static/images/mockups/station-${imgSource}.svg">`)
  + `<p class="${imgSource}">${name}</p>
</div>`
}

function setNoDepartures() {
  setMessagesActive(true)
  $('.messages .textWrapper').innerHTML = '<img src="/static/images/mockups/no-boarding-train.svg" /><p>No trains are departing from this platform</p>'
}

function setMessagesActive(active) {
  if (active) {
    $('.topLineBanner').className = 'topLineBanner no-line'
    $('.messages').style = 'display: block;'
    $('.firstDepartureInfo').style = 'display: none;'
    $('.firstDepartureInfo~.greyLine').style = 'display: none;'
    $('.stoppingAt').style = 'display: none;'
  } else {
    $('.messages').style = 'display: none;'
    $('.firstDepartureInfo').style = 'display: flex;'
    $('.firstDepartureInfo~.greyLine').style = 'display: block;'
    $('.stoppingAt').style = 'display: block;'
  }
}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    let {departures, isCityStop} = body

    let firstDeparture = departures[0]
    if (!firstDeparture) {
      // Expand for RRB?
      return setNoDepartures()
    } else setMessagesActive(false)

    let firstDepartureClass = firstDeparture.codedLineName
    if (firstDeparture.type === 'vline') firstDepartureClass = 'vline'

    $('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass
    $('.firstDepartureInfo .scheduledDepartureTime').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))
    $('.firstDepartureInfo .destination').textContent = firstDeparture.destination
    $('.firstDepartureInfo .stoppingType').textContent = getStoppingType(firstDeparture, isCityStop)
    $('.firstDepartureInfo .platform').className = 'platform ' + firstDepartureClass
    $('.firstDepartureInfo .platform span').textContent = firstDeparture.platform
    $('.firstDepartureInfo .timeToDeparture span').textContent = firstDeparture.prettyTimeToDeparture
    $('.stoppingAt').className = 'stoppingAt ' + firstDepartureClass

    let stopCount = firstDeparture.additionalInfo.screenStops.length
    let {stopColumns, size} = splitStops(firstDeparture.additionalInfo.screenStops, false, {
      MAX_COLUMNS: 2,
      MIN_COLUMN_SIZE: 5,
      MAX_COLUMN_SIZE: 22
    })

    let firstColumn = stopColumns[0]
    let secondColumn = stopColumns[1] || []

    let stoppingHTML = `<div>` // left
    stoppingHTML += createStationRow(' ', 'stub')
    let hasTerminating = firstDeparture.additionalInfo.screenStops.length <= size
    stoppingHTML += `<div class="stationRow" data-name="${firstColumn[0].stopName}">
      <img src="/static/images/mockups/station-stops-at.svg" class="${firstDepartureClass}"/>
      <p class="${firstDepartureClass}">${firstColumn[0].stopName}</p>
    </div>`
    let expresses = []
    let expressPart = []

    let index = 0
    for (station of firstColumn.slice(1, hasTerminating ? -1 : stopCount)) {
      stoppingHTML += createStationRow(station.stopName, station.isExpress ? 'express' : 'stops-at')

      if (station.isExpress) {
        expressPart.push({name: station.stopName, index})
      } else {
        if (expressPart.length) {
          if (expressPart.length > 1)
            expresses.push({stations: expressPart, col: 1})
          expressPart = []
        }
      }
      index++
    }

    if (hasTerminating)
      stoppingHTML += createStationRow(firstColumn.slice(-1)[0].stopName, 'terminates')
    else {
      stoppingHTML += createStationRow(' ', 'halfstub')
      stoppingHTML += createStationRow(' ', 'filler')
      if (expressPart.length)
        expresses.push({stations: expressPart, col: 1})
    }

    stoppingHTML += `</div><div>` // right
    if (secondColumn.length) {
      expressPart = []
      index = 0

      stoppingHTML += createStationRow(' ', 'halfstub')
      stoppingHTML += createStationRow(' ', 'filler')
      for (station of secondColumn.slice(0, -1)) {
        stoppingHTML += createStationRow(station.stopName, station.isExpress ? 'express' : 'stops-at')

        if (station.isExpress) {
          expressPart.push({name: station.stopName, index})
        } else {
          if (expressPart.length) {
            if (expressPart.length > 1)
              expresses.push({stations: expressPart, col: 2})
            expressPart = []
          }
        }
        index++
      }

      if (expressPart.length)
        expresses.push({stations: expressPart, col: 2})
      stoppingHTML += createStationRow(secondColumn.slice(-1)[0].stopName, 'terminates')
    }
    stoppingHTML += `</div>`
    let containerDIV = document.createElement('div')
    containerDIV.innerHTML = stoppingHTML
    $('.stoppingAt').innerHTML = ''
    $('.stoppingAt').appendChild(containerDIV)

    expresses.forEach(express => {
      let column = $(`.stoppingAt > div > div:nth-child(${express.col})`)

      let firstStop = express.stations[0], lastStop = express.stations.slice(-1)[0]
      let startingTop = firstStop.index * 64 + 64
      let endingTop = lastStop.index * 64 + 128
      let middle = (startingTop + endingTop) / 2 - 12

      column.innerHTML += `<div class="expressArrow" style="margin-top: ${middle}px">
        <img src="/static/images/mockups/express-arrow.svg" class="${firstDepartureClass}"/>
        <img src="/static/images/mockups/express-arrow.svg"/>
      </div>`
    })

    let departureDIVs = Array.from(document.querySelectorAll('.smallDeparture'))
    let next4Departures = departures.concat([null, null, null, null]).slice(1, 5)

    next4Departures.forEach((departure, i) => {
      let departureDIV = departureDIVs[i]
      if (!!departure) {
        let departureClass = departure.codedLineName
        if (departure.type === 'vline') departureClass = 'vline'

        $('.sideBar', departureDIV).className = 'sideBar ' + departureClass
        $('.sideBar~p', departureDIV).textContent = formatTime(new Date(departure.scheduledDepartureTime))

        $('.centre p', departureDIV).textContent = departure.destination

        $('.right .platform', departureDIV).className = 'platform ' + departureClass
        $('.right .platform p', departureDIV).textContent = departure.platform

        $('.right .timeToDeparture p', departureDIV).textContent = departure.prettyTimeToDeparture.replace(' ', '')
      } else {
        $('.sideBar', departureDIV).className = 'sideBar no-line'
        $('.sideBar~p', departureDIV).textContent = '--'

        $('.centre p', departureDIV).textContent = '--'

        $('.right .platform', departureDIV).className = 'platform no-line'
        $('.right .platform p', departureDIV).innerHTML = '&nbsp;'

        $('.right .timeToDeparture p', departureDIV).innerHTML = '&nbsp;'
      }
    })
  })
}

function setBodyScaling() {
  let ratio = window.innerHeight / 1920
  $('html').style = `transform: scale(${ratio});`
}

$.ready(() => {
  if (location.search.includes('scale')) {
    window.addEventListener('resize', setBodyScaling)
    setBodyScaling()
  }
  setInterval(updateBody, 1000 * 60)
  updateBody()
})
